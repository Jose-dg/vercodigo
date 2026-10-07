import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/auth/guard";
import { AppError } from "@/lib/errors";
import { applySaleReprice } from "@/services/pricing/sale-repricing.service";
import type { TokenPayload } from "@/lib/auth";

const Body = z.object({
    targetType: z.enum(["CODE_PURCHASE", "CARD_ACTIVATION"]),
    targetId: z.string().min(1),
    newRate: z.number().positive(),
    reason: z.string().trim().min(3).max(500),
    fingerprint: z.string().length(64),
});

async function handler(req: NextRequest, _ctx: unknown, _ability: unknown, user: TokenPayload) {
    try {
        const parsed = Body.safeParse(await req.json());
        if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
        const idempotencyKey = req.headers.get("Idempotency-Key")?.trim();
        if (!idempotencyKey || idempotencyKey.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(idempotencyKey)) {
            return NextResponse.json({ error: "Idempotency-Key inválida" }, { status: 400 });
        }
        const correction = await applySaleReprice({
            ...parsed.data,
            idempotencyKey,
            actorId: user.id,
        });
        return NextResponse.json({ success: true, correction });
    } catch (error) {
        if (error instanceof AppError) return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
        console.error("[sales/reprice/apply]", error);
        return NextResponse.json({ error: "INTERNAL", message: error instanceof Error ? error.message : "Error inesperado" }, { status: 500 });
    }
}

export const POST = withAuth("manage", "ProductCost", handler);
