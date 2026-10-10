import { NextRequest, NextResponse } from "next/server";
import type { UserRole } from "@prisma/client";

import type { TokenPayload } from "@/lib/auth";
import { isPlatformRole } from "@/lib/auth/abilities";
import { withAuth } from "@/lib/auth/guard";
import { AppError } from "@/lib/errors";
import { getPurchaseQuotes } from "@/services/costing/costing.service";

async function handler(req: NextRequest, _ctx: unknown, _ability: unknown, user: TokenPayload) {
    try {
        const requested = req.nextUrl.searchParams.get("companyId");
        const platform = isPlatformRole(user.role as UserRole);
        if (!platform && requested && requested !== user.companyId) {
            return NextResponse.json({ error: "FORBIDDEN", message: "Compañía fuera de alcance" }, { status: 403 });
        }
        const companyId = platform ? requested : user.companyId;
        if (!companyId) {
            return NextResponse.json({ error: "BAD_REQUEST", message: "companyId es requerido" }, { status: 400 });
        }
        return NextResponse.json({ rows: await getPurchaseQuotes(companyId) });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
        }
        console.error("[codes/quotes]", error);
        return NextResponse.json({ error: "INTERNAL", message: "Error inesperado" }, { status: 500 });
    }
}

export const GET = withAuth("create", "CodePurchase", handler);
