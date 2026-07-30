import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/auth/guard";
import { AppError } from "@/lib/errors";
import { recharge } from "@/services/wallet/wallet.service";

const RechargeBody = z.object({
    companyId: z.string().min(1),
    amount: z.number().positive(),
    externalReference: z.string().max(200).optional(),
    description: z.string().max(500).optional(),
});

/**
 * POST /api/wallets/recharge — registra un abono manual a la wallet de una
 * compañía. Solo plataforma: withAuth('manage', 'Wallet') deja pasar únicamente
 * a SUPER_ADMIN (manage all) y SYSTEM_ADMIN (manage Wallet).
 */
async function handler(req: NextRequest, ctx: any, ability: any, user: any) {
    try {
        const parsed = RechargeBody.safeParse(await req.json());
        if (!parsed.success) {
            return NextResponse.json(
                { error: "BAD_REQUEST", message: "Payload inválido", details: parsed.error.issues },
                { status: 400 }
            );
        }

        const tx = await recharge({ ...parsed.data, actorId: user.id });
        return NextResponse.json({ success: true, transaction: tx }, { status: 201 });
    } catch (e: any) {
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
