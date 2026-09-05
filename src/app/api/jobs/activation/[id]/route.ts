import { NextRequest, NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth/guard";

async function handler(
    _request: NextRequest,
    context: { params: Promise<{ id: string }> },
    _ability: unknown,
    user: { id: string },
) {
    const { id } = await context.params;
    // Solo lectura local. El avance lo dispara el webhook Diem → /api/webhook/fulfillment.
    const owned = await prisma.activationJob.findFirst({
        where: { id, userId: user.id },
        select: {
            id: true,
            status: true,
            lastError: true,
            nextRetryAt: true,
            fulfillmentStatus: true,
            diemRequestId: true,
        },
    });
    if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const terminal = ["COMPLETED", "FAILED", "ACTION_REQUIRED"].includes(owned.status);
    return NextResponse.json({
        success: true,
        processing: !terminal,
        jobId: owned.id,
        status: owned.status,
        lastError: owned.lastError,
        nextRetryAt: owned.nextRetryAt,
        fulfillmentStatus: owned.fulfillmentStatus,
        diemRequestId: owned.diemRequestId,
    });
}

export const GET = withAuth("read", "Card", handler);
