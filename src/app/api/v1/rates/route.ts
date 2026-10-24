import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { withApiKey } from "@/lib/auth/api-key-guard";
import { getPurchaseQuotes } from "@/services/costing/costing.service";

export const GET = withApiKey("catalog:read", async (_req, _ctx, principal) => {
    const quotes = await getPurchaseQuotes(principal.companyId);
    const products = await prisma.product.findMany({
        where: { id: { in: [...new Set(quotes.map((quote) => quote.productId))] } },
        select: { id: true, name: true, brand: true },
    });
    const productById = new Map(products.map((product) => [product.id, product]));
    return NextResponse.json({
        object: "list",
        livemode: principal.environment === "LIVE",
        data: quotes.flatMap((quote) => {
            const product = productById.get(quote.productId);
            return product ? [{
                product_id: quote.productId,
                denomination_id: quote.denominationId,
                name: product.name,
                brand: product.brand,
                unit_price: { amount: quote.salePrice, currency: quote.currency },
            }] : [];
        }),
    });
});
