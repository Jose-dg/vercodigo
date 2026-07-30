import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { purchaseCodes } from "@/services/self-service/purchase-codes.service";
import { withAuth } from "@/lib/auth/guard";
import type { AppAbility } from "@/lib/auth/abilities";
import type { TokenPayload } from "@/lib/auth";

const PurchaseBody = z.object({
    productId: z.string().min(1),
    denominationId: z.string().optional(),
    count: z.number().int().min(1).max(100),
    storeId: z.string().optional(),
});

async function handler(
    req: NextRequest,
    _ctx: unknown,
    _ability: AppAbility,
    user: TokenPayload,
) {
    try {
        // 2. Body Validation
        const raw = await req.json();
        const parsed = PurchaseBody.safeParse(raw);
        if (!parsed.success) {
            return NextResponse.json(
                { error: "BAD_REQUEST", message: "Payload inválido", details: parsed.error.issues },
                { status: 400 }
            );
        }
        const { productId, denominationId, count, storeId } = parsed.data;
        const idempotencyKey = req.headers.get("idempotency-key")?.trim();
        if (
            !idempotencyKey
            || idempotencyKey.length > 128
            || !/^[A-Za-z0-9._:-]+$/.test(idempotencyKey)
        ) {
            return NextResponse.json(
                {
                    error: "BAD_REQUEST",
                    message: "Idempotency-Key es requerido y debe tener un formato válido",
                },
                { status: 400 },
            );
        }

        // 3. Purchase Service
        const result = await purchaseCodes({
            userId: user.id, // User from Guard
            storeId,
            productId,
            denominationId,
            count,
            idempotencyKey,
        });

        return NextResponse.json({ success: true, purchase: result }, { status: 201 });
    } catch (e: unknown) {
        if (e instanceof AppError) {
            return NextResponse.json(
                { error: e.code, message: e.message, details: e.details },
                { status: e.status }
            );
        }
        console.error("[codes/purchase] Error:", e);
        return NextResponse.json(
            { error: "INTERNAL", message: "Error inesperado" },
            { status: 500 }
        );
    }
}

export const POST = withAuth('create', 'CodePurchase', handler);
