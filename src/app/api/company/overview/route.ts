import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/guard";
import { AppError } from "@/lib/errors";
import { getCompanyOverview } from "@/services/company/overview.service";

/**
 * GET /api/company/overview — resumen operativo de la compañía (todos los
 * locales). OWNER/GENERAL_ADMIN ven la suya; plataforma pasa ?companyId=.
 * withAuth('read','Company') excluye a ADMIN/OPERATOR (no tienen read Company).
 */
async function handler(req: NextRequest, ctx: any, ability: any, user: any) {
    try {
        const isPlatform = user.role === "SUPER_ADMIN" || user.role === "SYSTEM_ADMIN";
        const companyId = isPlatform
            ? req.nextUrl.searchParams.get("companyId")
            : user.companyId;

        if (!companyId) {
            return NextResponse.json(
                { error: "BAD_REQUEST", message: isPlatform ? "companyId es requerido" : "Usuario sin compañía asignada" },
                { status: isPlatform ? 400 : 403 }
            );
        }

        const overview = await getCompanyOverview(companyId);
        return NextResponse.json(overview);
    } catch (e: any) {
        if (e instanceof AppError) {
            return NextResponse.json(
                { error: e.code, message: e.message, details: e.details },
                { status: e.status }
            );
        }
        console.error("[company/overview] Error:", e);
        return NextResponse.json({ error: "INTERNAL", message: "Error inesperado" }, { status: 500 });
    }
}

export const GET = withAuth("read", "Company", handler);
