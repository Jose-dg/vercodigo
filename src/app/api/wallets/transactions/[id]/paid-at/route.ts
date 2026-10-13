import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { AuthenticatedActor } from "@/lib/auth/actor";
import { withAuth } from "@/lib/auth/guard";
import { AppError } from "@/lib/errors";
import { correctRechargeTime } from "@/services/wallet/recharge-time-correction.service";

const Body = z.object({
    /** Corrected payment time, with its UTC offset (e.g. 2026-10-11T09:30:00-05:00). */
    paidAt: z.string().datetime({ offset: true }),
    /** occurredAt the admin saw when opening the correction. */
    expectedOccurredAt: z.string().datetime({ offset: true }),
    reason: z.string().trim().min(3).max(500),
});

/**
 * PATCH /api/wallets/transactions/:id/paid-at — corrige la hora del pago de un
 * abono manual y recalcula los saldos del libro. Solo plataforma
 * (withAuth('manage', 'Wallet')); queda en AuditLog con el motivo.
 */
async function handler(
    req: NextRequest,
    ctx: { params: Promise<{ id: string }> },
    _ability: unknown,
    user: AuthenticatedActor,
) {
    try {
        const { id } = await ctx.params;
        const parsed = Body.safeParse(await req.json());
        if (!parsed.success) {
            return NextResponse.json(
                { error: "BAD_REQUEST", message: "Payload inválido", details: parsed.error.issues },
                { status: 400 }
            );
        }
        const result = await correctRechargeTime({
            transactionId: id,
            paidAt: new Date(parsed.data.paidAt),
            expectedOccurredAt: new Date(parsed.data.expectedOccurredAt),
            reason: parsed.data.reason,
            actorId: user.id,
        });
        return NextResponse.json({ success: true, ...result });
    } catch (e) {
        if (e instanceof AppError) {
            return NextResponse.json(
                { error: e.code, message: e.message, details: e.details },
                { status: e.status }
            );
        }
        console.error("[wallets/transactions/paid-at] Error:", e);
        return NextResponse.json({ error: "INTERNAL", message: "Error inesperado" }, { status: 500 });
    }
}

export const PATCH = withAuth("manage", "Wallet", handler);
