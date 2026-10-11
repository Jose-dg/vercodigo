import crypto from "crypto";

import prisma from "@/lib/prisma";
import { processActivationJob, updateOpenActivationJob } from "@/services/self-service/activate-card.service";
import { isSettledFulfillmentStatus } from "@/services/self-service/fulfillment-lifecycle";
import { processCodePurchase } from "@/services/self-service/purchase-codes.service";
import { updateOpenCodePurchase } from "@/services/self-service/code-purchase-state";
import {
    refreshReplacedActivationCode,
    refreshReplacedPurchaseCodes,
    reverseCancelledActivation,
    reverseCancelledCodePurchase,
    type PostDeliveryResult,
} from "@/services/self-service/post-delivery.service";

/**
 * A settled (COMPLETED) order can still change in Diem: a cancellation voids
 * the codes (refund) and delivery_pending means a bad code was replaced.
 * Anything else on a settled order is ignored.
 */
function postDeliveryAction(
    status: string,
    toStatus: string,
    actions: { reverse: () => Promise<PostDeliveryResult>; replace: () => Promise<PostDeliveryResult> },
): (() => Promise<PostDeliveryResult>) | null {
    if (status !== "COMPLETED") return null;
    if (toStatus === "cancelled") return actions.reverse;
    if (toStatus === "delivery_pending") return actions.replace;
    return null;
}

export type FulfillmentWebhookPayload = {
    event_id: string;
    code_request_id: string;
    external_reference: string;
    from_status: string;
    to_status: string;
    reason_code: string;
    occurred_at: string;
};

const ACTIONABLE_STATUSES = new Set([
    "allocated",
    "delivery_pending",
    "delivered",
    "partially_delivered",
    "action_required",
    "failed",
    "cancelled",
    "awaiting_stock",
    "pending_review",
    "processing",
    "received",
]);

export function verifyDiemFulfillmentSignature(body: string, signature: string | null): boolean {
    const secret = process.env.DIEM_FULFILLMENT_WEBHOOK_SECRET?.trim();
    if (!secret) {
        // Dev convenience: allow unsigned only when secret is unset.
        return process.env.NODE_ENV !== "production";
    }
    if (!signature) return false;
    const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
    const provided = signature.trim().toLowerCase();
    const expectedBuf = Buffer.from(expected, "utf8");
    const providedBuf = Buffer.from(provided, "utf8");
    if (expectedBuf.length !== providedBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

function parsePayload(body: unknown): FulfillmentWebhookPayload | null {
    if (!body || typeof body !== "object") return null;
    const row = body as Record<string, unknown>;
    if (
        typeof row.event_id !== "string"
        || typeof row.code_request_id !== "string"
        || typeof row.external_reference !== "string"
        || typeof row.to_status !== "string"
    ) {
        return null;
    }
    return {
        event_id: row.event_id,
        code_request_id: row.code_request_id,
        external_reference: row.external_reference,
        from_status: typeof row.from_status === "string" ? row.from_status : "",
        to_status: row.to_status,
        reason_code: typeof row.reason_code === "string" ? row.reason_code : "",
        occurred_at: typeof row.occurred_at === "string" ? row.occurred_at : "",
    };
}

export async function handleDiemFulfillmentWebhook(rawBody: string): Promise<{
    ok: boolean;
    handled: boolean;
    kind?: "purchase" | "activation";
    id?: string;
    status?: string;
    reason?: string;
}> {
    let parsed: unknown;
    try {
        parsed = JSON.parse(rawBody);
    } catch {
        return { ok: false, handled: false, reason: "invalid_json" };
    }
    const payload = parsePayload(parsed);
    if (!payload) {
        return { ok: false, handled: false, reason: "invalid_payload" };
    }
    if (!payload.external_reference.startsWith("DIEM-SAS-")) {
        return { ok: true, handled: false, reason: "ignored_reference" };
    }
    if (!ACTIONABLE_STATUSES.has(payload.to_status)) {
        return { ok: true, handled: false, reason: "ignored_status" };
    }

    if (payload.external_reference.startsWith("DIEM-SAS-PURCHASE-")) {
        const purchase = await prisma.codePurchase.findFirst({
            where: {
                OR: [
                    { diemRequestId: payload.code_request_id },
                    { id: payload.external_reference.replace(/^DIEM-SAS-PURCHASE-/, "") },
                ],
            },
            select: { id: true, status: true, diemRequestId: true },
        });
        if (!purchase) {
            return { ok: true, handled: false, reason: "purchase_not_found" };
        }
        if (purchase.diemRequestId && purchase.diemRequestId !== payload.code_request_id) {
            return { ok: false, handled: false, reason: "code_request_mismatch" };
        }
        // Settled purchases are immutable; only open ones record remote progress.
        await updateOpenCodePurchase(prisma, purchase.id, {
            fulfillmentStatus: payload.to_status,
            diemRequestId: payload.code_request_id,
            nextRetryAt: null,
        });
        const purchaseFollowUp = postDeliveryAction(purchase.status, payload.to_status, {
            reverse: () => reverseCancelledCodePurchase(purchase.id),
            replace: () => refreshReplacedPurchaseCodes(purchase.id),
        });
        if (purchaseFollowUp) {
            const result = await purchaseFollowUp();
            return { ok: true, handled: true, kind: "purchase", id: purchase.id, status: result.status, reason: result.action };
        }
        if (isSettledFulfillmentStatus(purchase.status)) {
            return {
                ok: true,
                handled: true,
                kind: "purchase",
                id: purchase.id,
                status: purchase.status,
                reason: "already_settled",
            };
        }
        const processed = await processCodePurchase(purchase.id);
        return {
            ok: true,
            handled: true,
            kind: "purchase",
            id: purchase.id,
            status: processed.status,
        };
    }

    if (payload.external_reference.startsWith("DIEM-SAS-ACTIVATION-")) {
        const job = await prisma.activationJob.findFirst({
            where: {
                OR: [
                    { diemRequestId: payload.code_request_id },
                    { id: payload.external_reference.replace(/^DIEM-SAS-ACTIVATION-/, "") },
                ],
            },
            select: { id: true, status: true, diemRequestId: true },
        });
        if (!job) {
            return { ok: true, handled: false, reason: "activation_not_found" };
        }
        if (job.diemRequestId && job.diemRequestId !== payload.code_request_id) {
            return { ok: false, handled: false, reason: "code_request_mismatch" };
        }
        await updateOpenActivationJob(prisma, job.id, {
            fulfillmentStatus: payload.to_status,
            diemRequestId: payload.code_request_id,
            nextRetryAt: null,
        });
        const activationFollowUp = postDeliveryAction(job.status, payload.to_status, {
            reverse: () => reverseCancelledActivation(job.id),
            replace: () => refreshReplacedActivationCode(job.id),
        });
        if (activationFollowUp) {
            const result = await activationFollowUp();
            return { ok: true, handled: true, kind: "activation", id: job.id, status: result.status, reason: result.action };
        }
        if (isSettledFulfillmentStatus(job.status)) {
            return {
                ok: true,
                handled: true,
                kind: "activation",
                id: job.id,
                status: job.status,
                reason: "already_settled",
            };
        }
        const processed = await processActivationJob(job.id);
        return {
            ok: true,
            handled: true,
            kind: "activation",
            id: job.id,
            status: processed.status,
        };
    }

    return { ok: true, handled: false, reason: "unknown_reference_kind" };
}
