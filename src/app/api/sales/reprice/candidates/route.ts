import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/guard";
import { listRepriceCandidates } from "@/services/pricing/sale-repricing.service";

async function handler(req: NextRequest) {
    const companyId = req.nextUrl.searchParams.get("companyId")?.trim();
    if (!companyId) return NextResponse.json({ error: "companyId es requerido" }, { status: 400 });
    const candidates = await listRepriceCandidates({
        companyId,
        query: req.nextUrl.searchParams.get("query") ?? undefined,
    });
    return NextResponse.json({ candidates });
}

export const GET = withAuth("manage", "ProductCost", handler);
