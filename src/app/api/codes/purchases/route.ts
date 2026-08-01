import { NextRequest, NextResponse } from "next/server";

import { AppError } from "@/lib/errors";
import { withAuth } from "@/lib/auth/guard";
import {
    listCodePurchasesForUser,
    refreshPendingCodePurchasesForUser,
} from "@/services/self-service/purchase-codes.service";

async function handler(
    req: NextRequest,
    _ctx: unknown,
    _ability: unknown,
    user: { id: string; role: string; companyId: string | null; storeId: string | null },
) {
    try {
        const refresh = req.nextUrl.searchParams.get("refresh") === "1";
        const companyId = req.nextUrl.searchParams.get("companyId");
        const limitParam = req.nextUrl.searchParams.get("limit");
        const limit = limitParam ? Number(limitParam) : undefined;

        const buckets = refresh
            ? await refreshPendingCodePurchasesForUser(user)
            : await listCodePurchasesForUser(user, {
                limit: Number.isFinite(limit) ? limit : undefined,
                companyId,
            });

        return NextResponse.json({ success: true, ...buckets });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(
                { error: error.code, message: error.message },
                { status: error.status },
            );
        }
        return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
    }
}

export const GET = withAuth("read", "CodePurchase", handler);
