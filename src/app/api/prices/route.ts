import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/auth/guard";
import { AppError } from "@/lib/errors";
import { getPriceCatalog, upsertPrice } from "@/services/pricing/pricing.service";

const UpsertBody = z.object({
    companyId: z.string().optional(),
    productId: z.string().min(1),
    denominationId: z.string().optional().nullable(),
    salePrice: z.number().positive(),
    currency: z.string().length(3).optional(),
});

/**
 * GET /api/prices — catálogo de precios de la compañía del actor
 * (plataforma: pasa ?companyId=). PUT — upsert de un precio.
 */
async function getHandler(req: NextRequest, ctx: any, ability: any, user: any) {
    try {
        const companyId = req.nextUrl.searchParams.get("companyId");
        const catalog = await getPriceCatalog(user, companyId);
        return NextResponse.json(catalog);
    } catch (e: any) {
        if (e instanceof AppError) {
            return NextResponse.json(
                { error: e.code, message: e.message, details: e.details },
                { status: e.status }
            );
        }
        console.error("[prices/get] Error:", e);
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
        const price = await upsertPrice(parsed.data, user);
        return NextResponse.json({ success: true, price });
    } catch (e: any) {
        if (e instanceof AppError) {
            return NextResponse.json(
                { error: e.code, message: e.message, details: e.details },
                { status: e.status }
            );
        }
        console.error("[prices/put] Error:", e);
        return NextResponse.json({ error: "INTERNAL", message: "Error inesperado" }, { status: 500 });
    }
}

export const GET = withAuth("read", "CompanyProductPrice", getHandler);
export const PUT = withAuth("update", "CompanyProductPrice", putHandler);
