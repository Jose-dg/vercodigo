import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withAuth } from "@/lib/auth/guard";
import { AppError } from "@/lib/errors";
import type { TokenPayload } from "@/lib/auth";
import { getTrmPriceList, setTrmSpreadCop } from "@/services/pricing/trm.service";

function isPlatformRole(role: string) {
    return role === "SUPER_ADMIN" || role === "SYSTEM_ADMIN";
}

const Body = z.object({ spreadCop: z.number().int() });

function errorResponse(scope: string, error: unknown) {
    if (error instanceof AppError) {
        return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    }
    console.error(`[pricing/trm/${scope}]`, error);
    return NextResponse.json({ error: "INTERNAL", message: "Error inesperado" }, { status: 500 });
}

/** GET /api/pricing/trm — TRM del día, tasa mayorista y lista de precios de región USA. */
async function getHandler(_req: NextRequest, _ctx: unknown, _ability: unknown, user: TokenPayload) {
    try {
        return NextResponse.json(await getTrmPriceList({ includeConfiguredCost: isPlatformRole(user.role) }));
    } catch (error) {
        return errorResponse("get", error);
    }
}

/** PUT /api/pricing/trm — margen en pesos sobre la TRM redondeada (solo plataforma). */
async function putHandler(req: NextRequest, _ctx: unknown, _ability: unknown, user: TokenPayload) {
    try {
        if (!isPlatformRole(user.role)) {
            return NextResponse.json({ error: "FORBIDDEN", message: "Solo la plataforma define el margen" }, { status: 403 });
        }
        const parsed = Body.safeParse(await req.json().catch(() => null));
        if (!parsed.success) {
            return NextResponse.json({ error: "BAD_REQUEST", message: "El margen debe ser un número entero de pesos" }, { status: 400 });
        }
        const spreadCop = await setTrmSpreadCop(parsed.data.spreadCop);
        return NextResponse.json({ success: true, spreadCop });
    } catch (error) {
        return errorResponse("put", error);
    }
}

export const GET = withAuth("read", "ProductCost", getHandler);
export const PUT = withAuth("manage", "ProductCost", putHandler);
