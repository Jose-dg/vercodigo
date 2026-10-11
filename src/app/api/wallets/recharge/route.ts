import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { AuthenticatedActor } from "@/lib/auth/actor";
import { withAuth } from "@/lib/auth/guard";
import { AppError } from "@/lib/errors";
import { manualRechargeFingerprint } from "@/lib/wallet/recharge-request";
import { recharge } from "@/services/wallet/wallet.service";

const RechargeBody = z.object({
    companyId: z.string().min(1),
    amount: z.number().positive().finite(),
    /** When the transfer was made, with its UTC offset (e.g. 2026-10-11T09:30:00-05:00). */
    paidAt: z.string().datetime({ offset: true }),
    externalReference: z.string().trim().min(1).max(200),
    description: z.string().max(500).optional(),
});

const IdempotencyKey = z.string().trim().min(8).max(200);

/**
 * POST /api/wallets/recharge — registra un abono manual a la wallet de una
 * compañía. Solo plataforma: withAuth('manage', 'Wallet') deja pasar únicamente
 * a SUPER_ADMIN (manage all) y SYSTEM_ADMIN (manage Wallet).
 *
 * El movimiento queda con la hora del pago (`paidAt`), no con la hora en que
 * se registra. Requiere `Idempotency-Key`: un reintento con la misma clave y
 * los mismos datos devuelve el mismo abono (200); con otros datos, 409.
 */
async function handler(req: NextRequest, _ctx: unknown, _ability: unknown, user: AuthenticatedActor) {
    try {
        const key = IdempotencyKey.safeParse(req.headers.get("idempotency-key") ?? "");
        if (!key.success) {
            return NextResponse.json(
                { error: "BAD_REQUEST", message: "Falta el encabezado Idempotency-Key" },
                { status: 400 }
            );
        }
        const parsed = RechargeBody.safeParse(await req.json());
        if (!parsed.success) {
            return NextResponse.json(
                { error: "BAD_REQUEST", message: "Payload inválido", details: parsed.error.issues },
                { status: 400 }
            );
        }

        const { paidAt, ...body } = parsed.data;
        const occurredAt = new Date(paidAt);
        const { transaction, replayed } = await recharge({
            ...body,
            occurredAt,
            occurredAtSource: "PAYMENT",
            method: "MANUAL",
            idempotencyKey: key.data,
            requestFingerprint: manualRechargeFingerprint({
                companyId: body.companyId,
                amount: body.amount,
                occurredAt,
                externalReference: body.externalReference,
            }),
            actorId: user.id,
        });
        return NextResponse.json(
            { success: true, replayed, transaction },
            { status: replayed ? 200 : 201 }
        );
    } catch (e) {
        if (e instanceof AppError) {
            return NextResponse.json(
                { error: e.code, message: e.message, details: e.details },
                { status: e.status }
            );
        }
        console.error("[wallets/recharge] Error:", e);
        return NextResponse.json({ error: "INTERNAL", message: "Error inesperado" }, { status: 500 });
    }
}

export const POST = withAuth("manage", "Wallet", handler);
