import prisma from "@/lib/prisma";
import { getCodeRequest, revealCodeRequest } from "@/lib/devdiem/fulfillment";
import { reverseConsumption } from "@/services/wallet/wallet.service";
import { writeAuditLog } from "./audit.service";

/**
 * What Diem can still do to a request after SAS settled it as COMPLETED:
 *
 * - cancel it (order change / write-off): the codes are void, so the wallet
 *   consumption is refunded and the order becomes REVERSED;
 * - replace a bad code (delivered → delivery_pending): SAS reveals again and
 *   stores the replacement, without charging again.
 *
 * Webhook payloads are only triggers. Every action re-reads Diem first and is
 * a compare-and-set on the order still being COMPLETED, so replays and races
 * are harmless.
 */

const REVEALABLE = new Set(["allocated", "delivery_pending", "partially_delivered", "delivered"]);

export type PostDeliveryResult = { status: string; action: "reversed" | "codes_replaced" | "unchanged"; reason?: string };

function codesOf(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((code): code is string => typeof code === "string") : [];
}

const sameCodes = (a: string[], b: string[]) => a.length === b.length && a.every((code, index) => code === b[index]);

function cancellationMessage() {
    return "Diem anuló la entrega después de completada. Se reembolsó el cobro en la wallet; los códigos entregados quedan sin validez.";
}

export async function reverseCancelledCodePurchase(purchaseId: string): Promise<PostDeliveryResult> {
    const purchase = await prisma.codePurchase.findUniqueOrThrow({ where: { id: purchaseId } });
    if (purchase.status !== "COMPLETED" || !purchase.diemRequestId) return { status: purchase.status, action: "unchanged" };
    const remote = await getCodeRequest(purchase.diemRequestId);
    if (remote.status !== "cancelled") return { status: purchase.status, action: "unchanged", reason: `diem_${remote.status}` };

    const reversed = await prisma.$transaction(async (tx) => {
        const claimed = await tx.codePurchase.updateMany({
            where: { id: purchase.id, status: "COMPLETED" },
            data: { status: "REVERSED", fulfillmentStatus: "cancelled", lastError: cancellationMessage() },
        });
        if (!claimed.count) return false;
        const consumption = await tx.walletTransaction.findUnique({ where: { codePurchaseId: purchase.id } });
        if (consumption) {
            await reverseConsumption({
                consumptionId: consumption.id,
                description: `Reembolso: Diem anuló la compra ${purchase.id}`,
                tx,
            });
        }
        return true;
    });
    if (!reversed) {
        const current = await prisma.codePurchase.findUniqueOrThrow({ where: { id: purchase.id }, select: { status: true } });
        return { status: current.status, action: "unchanged" };
    }
    await writeAuditLog({
        action: "CODE_PURCHASE_REVERSED",
        userId: purchase.userId,
        companyId: purchase.companyId,
        storeId: purchase.storeId,
        entityType: "CodePurchase",
        entityId: purchase.id,
        before: { status: "COMPLETED", deliveredCodes: purchase.deliveredCodes },
        after: { status: "REVERSED" },
        details: { diemRequestId: purchase.diemRequestId, trigger: "diem_cancelled_after_delivery" },
    });
    return { status: "REVERSED", action: "reversed" };
}

export async function reverseCancelledActivation(jobId: string): Promise<PostDeliveryResult> {
    const job = await prisma.activationJob.findUniqueOrThrow({
        where: { id: jobId },
        include: { card: { include: { store: true, activation: true } } },
    });
    if (job.status !== "COMPLETED" || !job.diemRequestId) return { status: job.status, action: "unchanged" };
    const remote = await getCodeRequest(job.diemRequestId);
    if (remote.status !== "cancelled") return { status: job.status, action: "unchanged", reason: `diem_${remote.status}` };

    const reversed = await prisma.$transaction(async (tx) => {
        const claimed = await tx.activationJob.updateMany({
            where: { id: job.id, status: "COMPLETED" },
            data: {
                status: "REVERSED",
                fulfillmentStatus: "cancelled",
                lastError: `${cancellationMessage()} La tarjeta requiere revisión para reemitirla.`,
            },
        });
        if (!claimed.count) return false;
        const activation = job.card.activation;
        const consumption = activation
            ? await tx.walletTransaction.findUnique({ where: { cardActivationId: activation.id } })
            : null;
        if (consumption) {
            await reverseConsumption({
                consumptionId: consumption.id,
                description: `Reembolso: Diem anuló la activación ${job.card.uuid}`,
                tx,
            });
        }
        return true;
    });
    if (!reversed) {
        const current = await prisma.activationJob.findUniqueOrThrow({ where: { id: job.id }, select: { status: true } });
        return { status: current.status, action: "unchanged" };
    }
    await writeAuditLog({
        action: "ACTIVATION_REVERSED",
        userId: job.userId ?? job.card.activation?.activatedBy ?? "system",
        companyId: job.card.store.companyId,
        storeId: job.card.storeId,
        entityType: "Card",
        entityId: job.cardId,
        before: { status: "COMPLETED", deliveredCodes: job.deliveredCodes },
        after: { status: "REVERSED" },
        details: { jobId: job.id, cardUuid: job.card.uuid, diemRequestId: job.diemRequestId },
    });
    return { status: "REVERSED", action: "reversed" };
}

/** Diem replaced a bad code: reveal again and store the replacement. */
export async function refreshReplacedPurchaseCodes(purchaseId: string): Promise<PostDeliveryResult> {
    const purchase = await prisma.codePurchase.findUniqueOrThrow({ where: { id: purchaseId } });
    if (purchase.status !== "COMPLETED" || !purchase.diemRequestId) return { status: purchase.status, action: "unchanged" };
    const remote = await getCodeRequest(purchase.diemRequestId);
    if (!REVEALABLE.has(remote.status)) return { status: purchase.status, action: "unchanged", reason: `diem_${remote.status}` };

    let codes: string[];
    try {
        codes = await revealCodeRequest(remote.id, `code-purchase-replacement:${purchase.id}`);
    } catch (error) {
        // e.g. Diem's re-reveal window expired for the codes that were not
        // replaced. Keep the order settled and make the gap visible.
        await prisma.codePurchase.updateMany({
            where: { id: purchase.id, status: "COMPLETED" },
            data: {
                lastError: `Diem reemplazó un código pero no se pudo obtener: ${error instanceof Error ? error.message : "error"}`.slice(0, 1000),
            },
        });
        throw error;
    }
    const previous = codesOf(purchase.deliveredCodes);
    if (codes.length !== purchase.count || sameCodes(codes, previous)) {
        return { status: purchase.status, action: "unchanged", reason: "same_codes" };
    }
    const updated = await prisma.codePurchase.updateMany({
        where: { id: purchase.id, status: "COMPLETED" },
        data: { deliveredCodes: codes, fulfillmentStatus: "delivered", lastError: null },
    });
    if (!updated.count) return { status: "COMPLETED", action: "unchanged" };
    await writeAuditLog({
        action: "CODE_PURCHASE_CODES_REPLACED",
        userId: purchase.userId,
        companyId: purchase.companyId,
        storeId: purchase.storeId,
        entityType: "CodePurchase",
        entityId: purchase.id,
        before: { deliveredCodes: previous },
        after: { deliveredCodes: codes },
        details: { diemRequestId: purchase.diemRequestId },
    });
    return { status: "COMPLETED", action: "codes_replaced" };
}

/** Same for a QR activation: the card now points at the replacement code. */
export async function refreshReplacedActivationCode(jobId: string): Promise<PostDeliveryResult> {
    const job = await prisma.activationJob.findUniqueOrThrow({
        where: { id: jobId },
        include: { card: { include: { store: true } } },
    });
    if (job.status !== "COMPLETED" || !job.diemRequestId) return { status: job.status, action: "unchanged" };
    const remote = await getCodeRequest(job.diemRequestId);
    if (!REVEALABLE.has(remote.status)) return { status: job.status, action: "unchanged", reason: `diem_${remote.status}` };

    let codes: string[];
    try {
        codes = await revealCodeRequest(remote.id, `activation-replacement:${job.id}`);
    } catch (error) {
        await prisma.activationJob.updateMany({
            where: { id: job.id, status: "COMPLETED" },
            data: {
                lastError: `Diem reemplazó el código pero no se pudo obtener: ${error instanceof Error ? error.message : "error"}`.slice(0, 1000),
            },
        });
        throw error;
    }
    const previous = codesOf(job.deliveredCodes);
    if (codes.length !== 1 || sameCodes(codes, previous)) {
        return { status: job.status, action: "unchanged", reason: "same_codes" };
    }
    const replaced = await prisma.$transaction(async (tx) => {
        const updated = await tx.activationJob.updateMany({
            where: { id: job.id, status: "COMPLETED" },
            data: { deliveredCodes: codes, fulfillmentStatus: "delivered", lastError: null },
        });
        if (!updated.count) return false;
        const key = await tx.key.upsert({
            where: { code: codes[0] },
            update: { status: "SOLD", isVerified: true },
            create: {
                code: codes[0],
                productId: job.card.productId,
                status: "SOLD",
                isVerified: true,
                transactionId: remote.id,
            },
        });
        await tx.card.update({ where: { id: job.cardId }, data: { keyId: key.id, version: { increment: 1 } } });
        return true;
    });
    if (!replaced) return { status: "COMPLETED", action: "unchanged" };
    await writeAuditLog({
        action: "ACTIVATION_CODE_REPLACED",
        userId: job.userId ?? "system",
        companyId: job.card.store.companyId,
        storeId: job.card.storeId,
        entityType: "Card",
        entityId: job.cardId,
        before: { deliveredCodes: previous },
        after: { deliveredCodes: codes },
        details: { jobId: job.id, cardUuid: job.card.uuid, diemRequestId: job.diemRequestId },
    });
    return { status: "COMPLETED", action: "codes_replaced" };
}
