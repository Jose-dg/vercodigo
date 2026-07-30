import { NextRequest, NextResponse } from "next/server";

import { AppError } from "@/lib/errors";
import { withAuth } from "@/lib/auth/guard";
import { getCodePurchaseForUser, processCodePurchase } from "@/services/self-service/purchase-codes.service";

async function handler(
    _req: NextRequest,
    context: { params: Promise<{ id: string }> },
    _ability: unknown,
    user: { id: string },
) {
    try {
        const { id } = await context.params;
        let purchase = await getCodePurchaseForUser(id, user.id);
        if (purchase.isPending) {
            try {
                purchase = await processCodePurchase(id);
            } catch {
                purchase = await getCodePurchaseForUser(id, user.id);
            }
        }
        return NextResponse.json({ success: true, purchase });
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
