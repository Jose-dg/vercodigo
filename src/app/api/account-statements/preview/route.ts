import { NextRequest, NextResponse } from "next/server";

import { withAuth } from "@/lib/auth/guard";
import type { TokenPayload } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { previewAccountStatement } from "@/modules/account-statements/account-statement.service";

async function handler(req: NextRequest, _ctx: unknown, _ability: unknown, user: TokenPayload) {
    try {
        const companyId = req.nextUrl.searchParams.get("companyId");
        const cutoffValue = req.nextUrl.searchParams.get("cutoffAt");
        if (!companyId) {
            return NextResponse.json({ error: "BAD_REQUEST", message: "companyId es obligatorio" }, { status: 400 });
        }
        const cutoffAt = cutoffValue ? new Date(cutoffValue) : new Date();
        const preview = await previewAccountStatement({ companyId, cutoffAt, actor: user });
        return NextResponse.json({ preview });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json({ error: error.code, message: error.message, details: error.details }, { status: error.status });
        }
        console.error("[account-statements/preview]", error);
        return NextResponse.json({ error: "INTERNAL", message: "No se pudo preparar el estado de cuenta" }, { status: 500 });
    }
}

export const GET = withAuth("create", "AccountStatement", handler);
