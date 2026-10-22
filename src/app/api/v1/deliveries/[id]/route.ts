import { NextRequest, NextResponse } from "next/server";

import { withApiKey } from "@/lib/auth/api-key-guard";
import { getCodePurchaseForUser } from "@/services/self-service/purchase-codes.service";
import { serializeDelivery } from "@/modules/api-v1/serializers";

export const GET = withApiKey(
    "deliveries:read",
    async (_req: NextRequest, context: { params: Promise<{ id: string }> }, principal) => {
        const { id } = await context.params;
        // Scoped by the key's company through the purchase visibility filter.
        const purchase = await getCodePurchaseForUser(id, principal.actor);
        return NextResponse.json(serializeDelivery(purchase));
    },
);
