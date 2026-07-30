import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/guard";
import { AppError } from "@/lib/errors";
import { getWalletSummaries, getWalletForCompany } from "@/services/wallet/wallet.service";

/**
 * GET /api/wallets
 * Plataforma (SUPER_ADMIN/SYSTEM_ADMIN): todas las wallets con balance por compañía.
 * OWNER/GENERAL_ADMIN: su propia wallet con movimientos paginados (?page=).
 */
async function handler(req: NextRequest, ctx: any, ability: any, user: any) {
    try {
        const isPlatform = user.role === "SUPER_ADMIN" || user.role === "SYSTEM_ADMIN";

        if (isPlatform) {
            const summaries = await getWalletSummaries();
            return NextResponse.json({ scope: "platform", wallets: summaries });
        }

        if (!user.companyId) {
            return NextResponse.json(
                { error: "FORBIDDEN", message: "Usuario sin compañía asignada" },
                { status: 403 }
            );
        }

        const page = parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10) || 1;
        const data = await getWalletForCompany(user.companyId, { page });
        return NextResponse.json({ scope: "company", ...data });
    } catch (e: any) {
        if (e instanceof AppError) {
            return NextResponse.json(
                { error: e.code, message: e.message, details: e.details },
                { status: e.status }
            );
        }
        console.error("[wallets/list] Error:", e);
        return NextResponse.json({ error: "INTERNAL", message: "Error inesperado" }, { status: 500 });
    }
}

export const GET = withAuth("read", "Wallet", handler);
