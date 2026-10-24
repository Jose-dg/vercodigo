import { NextRequest, NextResponse } from "next/server";

import { apiError, withApiKey } from "@/lib/auth/api-key-guard";
import { getPublicTransaction } from "@/modules/api-v1/public-resources";

export const GET = withApiKey(
    "wallet:read",
    async (_req: NextRequest, context: { params: Promise<{ id: string }> }, principal) => {
        if (principal.environment === "SANDBOX") {
            return apiError(404, "NOT_FOUND", "Transacción no encontrada");
        }
        const { id } = await context.params;
        return NextResponse.json(await getPublicTransaction(principal.companyId, id));
    },
);
