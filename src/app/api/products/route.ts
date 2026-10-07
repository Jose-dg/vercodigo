import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedActor } from "@/lib/auth/actor";
import { checkDiemConnection } from "@/lib/devdiem/fulfillment";
import { createProductForActor, getProductsForManagement, getPurchasableProducts } from "@/services/product.service";
import { AppError } from "@/lib/errors";

const ProductBody = z.object({
    name: z.string().trim().min(1), sku: z.string().trim().min(1), brand: z.string().trim().min(1),
    category: z.string().trim().optional().nullable(), devDiemProductId: z.string().trim().optional().nullable(),
    denominations: z.array(z.object({ amount: z.number().positive(), currency: z.string().length(3), devDiemProductId: z.string().optional().nullable() })).default([]),
});

export async function GET(req: NextRequest) {
    try {
        const purchasableOnly = req.nextUrl.searchParams.get("purchasable") === "true";
        if (purchasableOnly) {
            const actor = await getAuthenticatedActor();
            if (!actor) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }

            let catalog;
            try {
                catalog = await checkDiemConnection();
            } catch (error) {
                const message = error instanceof Error ? error.message : 'No se pudo consultar el catálogo de Diem';
                console.error("[products/purchasable] Diem catalog error:", message);
                return NextResponse.json({ error: message }, { status: 503 });
            }

            const enabledIds = catalog.catalogProductIds;
            const products = await getPurchasableProducts(enabledIds);
            const regions = catalog.catalogProductRegions;
            const stock = catalog.catalogProductStock;
            return NextResponse.json(products.map((product) => ({
                ...product,
                countryRegion: product.devDiemProductId
                    ? regions[product.devDiemProductId] ?? null
                    : null,
                availableUnits: product.devDiemProductId != null
                    ? stock[product.devDiemProductId] ?? 0
                    : null,
                denominations: product.denominations.map((denomination) => {
                    const remoteId = denomination.devDiemProductId
                        ?? product.devDiemProductId
                        ?? '';
                    return {
                        ...denomination,
                        countryRegion: regions[remoteId] ?? null,
                        availableUnits: remoteId ? stock[remoteId] ?? 0 : null,
                    };
                }),
            })));
        }

        const actor = await getAuthenticatedActor();
        if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        return NextResponse.json(await getProductsForManagement(actor));
    } catch (error: unknown) {
        if (error instanceof AppError) return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal Server Error" },
            { status: 500 },
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        const actor = await getAuthenticatedActor();
        if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const parsed = ProductBody.safeParse(await req.json());
        if (!parsed.success) return NextResponse.json({ error: "BAD_REQUEST", details: parsed.error.issues }, { status: 400 });
        return NextResponse.json(await createProductForActor(actor, parsed.data), { status: 201 });
    } catch (error: unknown) {
        if (error instanceof AppError) return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
        console.error("Error creating product:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal Server Error" },
            { status: 500 }
        );
    }
}
