import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/guard";
import { AppError, notFound } from "@/lib/errors";
import prisma from "@/lib/prisma";
import { parseMovementQuery } from "@/lib/wallet/movement-query";
import { getWalletForCompany } from "@/services/wallet/wallet.service";

/**
 * GET /api/wallets/:companyId/transactions — movimientos de la wallet de una
 * compañía para la plataforma (?page=&type=&from=&to=), ordenados por fecha
 * efectiva. withAuth('manage', 'Wallet') solo deja pasar a SUPER_ADMIN y
 * SYSTEM_ADMIN; las compañías consultan su propia wallet en GET /api/wallets.
 */
async function handler(req: NextRequest, ctx: { params: Promise<{ companyId: string }> }) {
    try {
        const { companyId } = await ctx.params;
        const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true, name: true } });
        if (!company) throw notFound("Compañía no encontrada");
        const filters = parseMovementQuery(req.nextUrl.searchParams);
        const data = await getWalletForCompany(company.id, filters);
        return NextResponse.json({ scope: "platform", company, ...data });
    } catch (e) {
        if (e instanceof AppError) {
            return NextResponse.json(
                { error: e.code, message: e.message, details: e.details },
                { status: e.status }
            );
        }
        console.error("[wallets/transactions] Error:", e);
        return NextResponse.json({ error: "INTERNAL", message: "Error inesperado" }, { status: 500 });
    }
}

export const GET = withAuth("manage", "Wallet", handler);
