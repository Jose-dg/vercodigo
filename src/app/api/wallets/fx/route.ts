import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth/guard";
import { AppError } from "@/lib/errors";

const FX_KEY_PATTERN = /^FX_[A-Z]{3}_[A-Z]{3}$/;

const PutBody = z.object({
    key: z.string().regex(FX_KEY_PATTERN, "Formato esperado: FX_USD_COP"),
    rate: z.number().positive(),
});

/**
 * GET /api/wallets/fx — lista las tasas FX configuradas en SystemConfig.
 * PUT /api/wallets/fx — crea/actualiza una tasa. Solo plataforma.
 */
async function getHandler() {
    try {
        const configs = await prisma.systemConfig.findMany({
            where: { key: { startsWith: "FX_" } },
            orderBy: { key: "asc" },
        });
        return NextResponse.json({
            rates: configs.map((c) => ({ key: c.key, rate: parseFloat(c.value), updatedAt: c.updatedAt })),
        });
    } catch (e) {
        console.error("[wallets/fx] Error:", e);
        return NextResponse.json({ error: "INTERNAL", message: "Error inesperado" }, { status: 500 });
    }
}

async function putHandler(req: NextRequest) {
    try {
        const parsed = PutBody.safeParse(await req.json());
        if (!parsed.success) {
            return NextResponse.json(
                { error: "BAD_REQUEST", message: "Payload inválido", details: parsed.error.issues },
                { status: 400 }
            );
        }

        const { key, rate } = parsed.data;
        const config = await prisma.systemConfig.upsert({
            where: { key },
            update: { value: String(rate) },
            create: { key, value: String(rate) },
        });
        return NextResponse.json({ success: true, key: config.key, rate });
    } catch (e: any) {
        if (e instanceof AppError) {
            return NextResponse.json(
                { error: e.code, message: e.message, details: e.details },
                { status: e.status }
            );
        }
        console.error("[wallets/fx] Error:", e);
        return NextResponse.json({ error: "INTERNAL", message: "Error inesperado" }, { status: 500 });
    }
}

export const GET = withAuth("manage", "Wallet", getHandler);
export const PUT = withAuth("manage", "Wallet", putHandler);
