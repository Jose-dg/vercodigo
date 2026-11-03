import { NextRequest, NextResponse } from "next/server";

import { reconcileCompletedCodePurchases } from "@/services/self-service/post-delivery.service";

function isAuthorized(request: NextRequest) {
    const secret = process.env.CRON_SECRET;
    return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(request: NextRequest) {
    if (!isAuthorized(request)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const results = await reconcileCompletedCodePurchases({ limit: 100 });
    return NextResponse.json({
        processed: results.length,
        reversed: results.filter((row) => row.action === "reversed").length,
        errors: results.filter((row) => row.status === "ERROR").length,
        results,
    });
}
