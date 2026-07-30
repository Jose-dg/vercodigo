import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/auth/guard";
import { AppError } from "@/lib/errors";
import { getCostCatalog, upsertCost } from "@/services/costing/costing.service";

const UpsertBody = z.object({
    companyId: z.string().optional().nullable(),
    productId: z.string().min(1),
    denominationId: z.string().optional().nullable(),
    cost: z.number().positive(),
    currency: z.string().length(3).optional(),
});

/**
 * GET /api/costs — catálogo de costos (global + override de ?companyId= si viene).
 * PUT /api/costs — upsert de un costo (global o por compañía). Solo plataforma.
 */
async function getHandler(req: NextRequest) {
    try {
        const companyId = req.nextUrl.searchParams.get("companyId");
        const catalog = await getCostCatalog(companyId);
        return NextResponse.json(catalog);
    } catch (e: any) {
        if (e instanceof AppError) {
            return NextResponse.json(
                { error: e.code, message: e.message, details: e.details },
                { status: e.status }
            );
        }
        console.error("[costs/get] Error:", e);
        return NextResponse.json({ error: "INTERNAL", message: "Error inesperado" }, { status: 500 });
    }
}

async function putHandler(req: NextRequest, ctx: any, ability: any, user: any) {
    try {
        const parsed = UpsertBody.safeParse(await req.json());
        if (!parsed.success) {
            return NextResponse.json(
                { error: "BAD_REQUEST", message: "Payload inválido", details: parsed.error.issues },
                { status: 400 }
            );
        }
        const cost = await upsertCost(parsed.data, user);
        return NextResponse.json({ success: true, cost });
    } catch (e: any) {
        if (e instanceof AppError) {
            return NextResponse.json(
                { error: e.code, message: e.message, details: e.details },
                { status: e.status }
            );
        }
        console.error("[costs/put] Error:", e);
        return NextResponse.json({ error: "INTERNAL", message: "Error inesperado" }, { status: 500 });
    }
}

export const GET = withAuth("manage", "ProductCost", getHandler);
export const PUT = withAuth("manage", "ProductCost", putHandler);
