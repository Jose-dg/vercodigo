import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { withApiKey } from "@/lib/auth/api-key-guard";
import { getPurchaseQuotes } from "@/services/costing/costing.service";
import { serializeCatalog } from "@/modules/api-v1/serializers";

export const GET = withApiKey("catalog:read", async (_req, _ctx, principal) => {
    const quotes = await getPurchaseQuotes(principal.companyId);
    const products = await prisma.product.findMany({
        where: { id: { in: [...new Set(quotes.map((quote) => quote.productId))] } },
        select: {
            id: true,
            name: true,
            brand: true,
            category: true,
            denominations: { select: { id: true, amount: true, currency: true, countryRegion: true } },
        },
        orderBy: [{ brand: "asc" }, { name: "asc" }],
    });
    return NextResponse.json({
        object: "list",
        livemode: principal.environment === "LIVE",
        // Real products and prices in both environments: reading never charges.
        data: serializeCatalog(products, quotes),
    });
});
