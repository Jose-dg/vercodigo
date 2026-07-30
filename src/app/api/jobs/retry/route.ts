import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { retryFailedJobs } from "@/services/self-service/retry-jobs.service";

export async function POST(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Only admins should trigger this manually
        if (auth.role !== "SUPER_ADMIN" && auth.role !== "SYSTEM_ADMIN") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const results = await retryFailedJobs();

        return NextResponse.json({
            success: true,
            message: "Retry process executed",
            results
        });

    } catch (e: any) {
        return NextResponse.json({
            error: "Internal Server Error",
            message: e.message
        }, { status: 500 });
    }
}
