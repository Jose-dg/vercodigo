import { NextRequest, NextResponse } from "next/server";

import { AppError } from "@/lib/errors";
import { withAuth } from "@/lib/auth/guard";
import {
    listCodePurchasesForUser,
} from "@/services/self-service/purchase-codes.service";

async function handler(
    req: NextRequest,
    _ctx: unknown,
    _ability: unknown,
    user: { id: string; role: string; companyId: string | null; storeId: string | null },
) {
    try {
        const companyId = req.nextUrl.searchParams.get("companyId");
        const limitParam = req.nextUrl.searchParams.get("limit");
        const limit = limitParam ? Number(limitParam) : undefined;

        // This read endpoint intentionally never advances fulfillment. The
        // webhook is the happy path and an explicit authenticated POST is the
        // manual recovery path. Browser polling stays side-effect-free.
        const buckets = await listCodePurchasesForUser(user, {
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
