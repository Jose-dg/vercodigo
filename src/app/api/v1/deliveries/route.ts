import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, withApiKey } from "@/lib/auth/api-key-guard";
import {
    InvalidDeliveryRecipientError,
    normalizeDeliveryRecipient,
} from "@/lib/codes/delivery-recipient";
import { purchaseCodes } from "@/services/self-service/purchase-codes.service";
import { serializeDelivery } from "@/modules/api-v1/serializers";

const DeliveryBody = z.object({
    product_id: z.string().min(1),
    denomination_id: z.string().min(1).optional(),
    quantity: z.number().int().min(1).max(100),
    recipient: z.object({
        first_name: z.string(),
        last_name: z.string().optional(),
        email: z.string(),
    }),
    /** Rejects the order instead of charging a different price than the client expects. */
    expected_unit_price: z.object({
        amount: z.number().positive(),
        currency: z.string().min(1).max(12),
    }).optional(),
});

const IDEMPOTENCY_KEY = /^[A-Za-z0-9._:-]{1,100}$/;

export const POST = withApiKey("deliveries:create", async (req, _ctx, principal) => {
    const idempotencyKey = req.headers.get("idempotency-key")?.trim() ?? "";
    if (!IDEMPOTENCY_KEY.test(idempotencyKey)) {
        return apiError(400, "BAD_REQUEST", "Idempotency-Key es obligatorio (1-100 caracteres: letras, números, . _ : -)");
    }
    let raw: unknown;
    try {
        raw = await req.json();
    } catch {
        return apiError(400, "BAD_REQUEST", "El cuerpo debe ser JSON");
    }
    const parsed = DeliveryBody.safeParse(raw);
    if (!parsed.success) {
        const issue = parsed.error.issues[0];
        return apiError(400, "BAD_REQUEST", `${issue.path.join(".") || "body"}: ${issue.message}`);
    }
    let recipient;
    try {
        recipient = normalizeDeliveryRecipient({
            firstName: parsed.data.recipient.first_name,
            lastName: parsed.data.recipient.last_name,
            email: parsed.data.recipient.email,
        });
    } catch (error) {
        if (error instanceof InvalidDeliveryRecipientError) return apiError(400, "BAD_REQUEST", error.message);
        throw error;
    }

    const purchase = await purchaseCodes({
        userId: principal.actor.id,
        actorRole: principal.actor.role,
        productId: parsed.data.product_id,
        denominationId: parsed.data.denomination_id,
        count: parsed.data.quantity,
        // Own namespace: an API retry never collides with a portal checkout key.
        idempotencyKey: `api:${idempotencyKey}`,
        quotedUnitAmount: parsed.data.expected_unit_price?.amount,
        quotedCurrency: parsed.data.expected_unit_price?.currency,
        recipient,
        channel: { kind: "api", apiKeyPrefix: principal.keyPrefix },
    });
    return NextResponse.json(serializeDelivery(purchase), { status: 201 });
});
