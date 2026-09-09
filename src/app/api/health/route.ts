import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
    return NextResponse.json(
        {
            status: "ok",
            release:
                process.env.VERCEL_GIT_COMMIT_SHA
                || process.env.RENDER_GIT_COMMIT
                || process.env.GIT_COMMIT_SHA
                || "unknown",
            commercialOrderContract: "required",
        },
        {
            headers: {
                "Cache-Control": "no-store",
            },
        },
    );
}
