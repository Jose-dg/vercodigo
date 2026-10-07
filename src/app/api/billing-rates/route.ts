import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withAuth } from "@/lib/auth/guard";
import { AppError } from "@/lib/errors";
import type { TokenPayload } from "@/lib/auth";
import {
    getCompanyProductRates,
    upsertCompanyProductRate,
} from "@/services/costing/costing.service";

function isPlatformRole(role: string) {
    return role === "SUPER_ADMIN" || role === "SYSTEM_ADMIN";
}
const Body = z.object({
    companyId: z.string().min(1),
    productId: z.string().min(1),
    rateCopPerUsd: z.number().positive(),
});

async function getHandler(req: NextRequest, _ctx: unknown, _ability: unknown, user: TokenPayload) {
    try {
        const requested = req.nextUrl.searchParams.get("companyId");
        const companyId = isPlatformRole(user.role)
            ? requested
            : user.companyId;
        if (!companyId) {
            return NextResponse.json({ error: "BAD_REQUEST", message: "companyId es requerido" }, { status: 400 });
        }
        if (!isPlatformRole(user.role) && requested && requested !== user.companyId) {
            return NextResponse.json({ error: "FORBIDDEN", message: "Compañía fuera de alcance" }, { status: 403 });
        }
        return NextResponse.json(await getCompanyProductRates(companyId));
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
        }
        console.error("[billing-rates/get]", error);
        return NextResponse.json({ error: "INTERNAL", message: "Error inesperado" }, { status: 500 });
    }
}

async function putHandler(req: NextRequest, _ctx: unknown, _ability: unknown, user: TokenPayload) {
    try {
        const parsed = Body.safeParse(await req.json());
        if (!parsed.success) {
            return NextResponse.json({ error: "BAD_REQUEST", message: "Datos inválidos" }, { status: 400 });
        }
        const rate = await upsertCompanyProductRate({ ...parsed.data, actorId: user.id });
        return NextResponse.json({ success: true, rate });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
        }
        console.error("[billing-rates/put]", error);
        return NextResponse.json({ error: "INTERNAL", message: "Error inesperado" }, { status: 500 });
    }
}

export const GET = withAuth("read", "ProductCost", getHandler);
export const PUT = withAuth("manage", "ProductCost", putHandler);
