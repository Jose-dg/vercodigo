import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/auth/guard";
import { AppError } from "@/lib/errors";
import { previewRechargeTimeCorrection } from "@/services/wallet/recharge-time-correction.service";

const Body = z.object({ paidAt: z.string().datetime({ offset: true }) });

/**
 * POST /api/wallets/transactions/:id/paid-at/preview — qué saldos cambian si
 * el abono pasa a la nueva hora del pago. No escribe nada.
 */
async function handler(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await ctx.params;
        const parsed = Body.safeParse(await req.json());
        if (!parsed.success) {
            return NextResponse.json(
                { error: "BAD_REQUEST", message: "Payload inválido", details: parsed.error.issues },
                { status: 400 }
            );
        }
        const preview = await previewRechargeTimeCorrection({ transactionId: id, paidAt: new Date(parsed.data.paidAt) });
        return NextResponse.json({ preview });
    } catch (e) {
        if (e instanceof AppError) {
            return NextResponse.json(
                { error: e.code, message: e.message, details: e.details },
                { status: e.status }
            );
        }
        console.error("[wallets/transactions/paid-at/preview] Error:", e);
        return NextResponse.json({ error: "INTERNAL", message: "Error inesperado" }, { status: 500 });
    }
}

export const POST = withAuth("manage", "Wallet", handler);
