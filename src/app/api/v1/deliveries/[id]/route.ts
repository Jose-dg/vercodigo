import { NextRequest, NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { withApiKey } from "@/lib/auth/api-key-guard";
import { getCodePurchaseForUser } from "@/services/self-service/purchase-codes.service";
import { getSandboxDelivery } from "@/modules/api-v1/sandbox";
import { serializeDelivery, serializeSandboxDelivery } from "@/modules/api-v1/serializers";

export const GET = withApiKey(
    "deliveries:read",
    async (_req: NextRequest, context: { params: Promise<{ id: string }> }, principal) => {
        const { id } = await context.params;
        if (principal.environment === "SANDBOX") {
            // A sandbox key only sees simulated deliveries, and a live key only real ones.
            const row = await getSandboxDelivery(principal.companyId, id);
            const product = await prisma.product.findUnique({ where: { id: row.productId }, select: { name: true } });
            return NextResponse.json(serializeSandboxDelivery(row, product?.name));
        }
        // Scoped by the key's company through the purchase visibility filter.
        const purchase = await getCodePurchaseForUser(id, principal.actor);
        return NextResponse.json(serializeDelivery(purchase));
    },
);
