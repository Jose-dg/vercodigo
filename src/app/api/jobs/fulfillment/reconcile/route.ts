import { NextRequest, NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { processActivationJob } from "@/services/self-service/activate-card.service";

function isAuthorized(request: NextRequest) {
    const secret = process.env.CRON_SECRET;
    return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(request: NextRequest) {
    if (!isAuthorized(request)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const jobs = await prisma.activationJob.findMany({
        where: {
            status: { in: ["PENDING", "PROCESSING", "AWAITING_STOCK"] },
            OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }],
            attempts: { lt: 20 },
        },
        orderBy: [{ nextRetryAt: "asc" }, { createdAt: "asc" }],
        take: 10,
        select: { id: true },
    });
    const results = [];
    for (const job of jobs) {
        try {
            const processed = await processActivationJob(job.id);
            results.push({ id: job.id, status: processed.status });
        } catch (error) {
            results.push({
                id: job.id,
                status: "ERROR",
                error: error instanceof Error ? error.message : "UNKNOWN",
            });
        }
    }
    return NextResponse.json({ processed: results.length, results });
}
