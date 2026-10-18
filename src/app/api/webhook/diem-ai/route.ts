import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { isDiemAiCallbackAuthorized } from "@/modules/notifications/diem-ai.client";
import { parseNotificationExternalRef } from "@/modules/notifications/domain";
import { writeAuditLog } from "@/services/self-service/audit.service";

const Receipt = z.object({
    event_id: z.string().min(1),
    external_ref: z.string().nullable(),
    status: z.enum(["sent", "skipped", "failed"]),
    provider_ref: z.string().nullable().optional(),
    // Texto; se acepta también el objeto de error ({type, message}) por robustez.
    reason: z.union([z.string(), z.record(z.string(), z.unknown())]).nullable().optional()
        .transform((value) => (value && typeof value === "object"
            ? String(value.message ?? value.type ?? JSON.stringify(value))
            : value ?? null)),
});

/**
 * POST /api/webhook/diem-ai — confirmación de diem-ai de un correo pedido con
 * dispatch "now": sent | skipped (p. ej. sin contacto) | failed. Queda en AuditLog
 * junto al pedido del aviso (notification.requested).
 */
export async function POST(request: NextRequest) {
    if (!isDiemAiCallbackAuthorized(request.headers.get("authorization"))) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const parsed = Receipt.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
    }
    const receipt = parsed.data;
    const ref = parseNotificationExternalRef(receipt.external_ref);
    if (!ref) {
        // No es un aviso de diem-sas: se acepta para que diem-ai no lo reintente.
        return NextResponse.json({ success: true, ignored: true });
    }
    const recipientIsUser = !ref.recipientKey.startsWith("team:");
    await writeAuditLog({
        action: `notification.${receipt.status}`,
        userId: recipientIsUser ? ref.recipientKey : "system",
        entityType: ref.aggregateType,
        entityId: ref.id,
        success: receipt.status !== "failed",
        errorMessage: receipt.status === "sent" ? null : receipt.reason?.slice(0, 500) ?? null,
        details: {
            template: ref.template,
            externalRef: receipt.external_ref,
            eventId: receipt.event_id,
            providerRef: receipt.provider_ref ?? null,
            recipient: recipientIsUser ? null : ref.recipientKey,
        },
    });
    return NextResponse.json({ success: true });
}
