import { NextRequest, NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth/guard";
import { processActivationJob } from "@/services/self-service/activate-card.service";

async function handler(
    _request: NextRequest,
    context: { params: Promise<{ id: string }> },
    _ability: unknown,
    user: { id: string },
) {
    const { id } = await context.params;
    const owned = await prisma.activationJob.findFirst({
        where: { id, userId: user.id },
        select: { id: true, status: true },
    });
    if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });
    try {
        const result = await processActivationJob(id);
        return NextResponse.json({ success: true, ...result });
    } catch {
        const job = await prisma.activationJob.findUnique({
            where: { id },
            select: { status: true, lastError: true },
        });
        return NextResponse.json({ success: true, processing: true, jobId: id, ...job });
    }
}

export const GET = withAuth("read", "Card", handler);
