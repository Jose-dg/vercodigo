import { NextRequest, NextResponse } from "next/server";

import { withApiKey } from "@/lib/auth/api-key-guard";
import { listEnvelope, parseCursorPagination } from "@/modules/api-v1/pagination";
import { listPublicTransactions } from "@/modules/api-v1/public-resources";

export const GET = withApiKey("wallet:read", async (req: NextRequest, _ctx, principal) => {
    const pagination = parseCursorPagination(req.nextUrl.searchParams);
    if (principal.environment === "SANDBOX") {
        return NextResponse.json({
            ...listEnvelope([], pagination.limit),
            livemode: false,
        });
    }
    const rows = await listPublicTransactions(principal.companyId, pagination);
    return NextResponse.json({
        ...listEnvelope(rows, pagination.limit),
        livemode: principal.environment === "LIVE",
    });
});
