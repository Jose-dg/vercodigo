import { NextRequest, NextResponse } from "next/server";

import { withApiKey } from "@/lib/auth/api-key-guard";
import { listEnvelope, parseCursorPagination } from "@/modules/api-v1/pagination";
import { listPublicOrders } from "@/modules/api-v1/public-resources";

export const GET = withApiKey("deliveries:read", async (req: NextRequest, _ctx, principal) => {
    const pagination = parseCursorPagination(req.nextUrl.searchParams);
    const rows = await listPublicOrders(principal.companyId, principal.environment, pagination);
    return NextResponse.json({
        ...listEnvelope(rows, pagination.limit),
        livemode: principal.environment === "LIVE",
    });
});
