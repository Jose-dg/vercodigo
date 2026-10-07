import { NextRequest, NextResponse } from "next/server";

import { withAuth } from "@/lib/auth/guard";
import type { AuthenticatedActor } from "@/lib/auth/actor";
import { listPurchaseOriginPhones } from "@/services/purchases/purchase-origin";

async function handler(req: NextRequest, _ctx: unknown, _ability: unknown, user: AuthenticatedActor) {
    const isPlatform = user.role === "SUPER_ADMIN" || user.role === "SYSTEM_ADMIN";
    const companyId = isPlatform
        ? req.nextUrl.searchParams.get("companyId")?.trim()
        : user.companyId;
    if (!companyId) {
        return NextResponse.json({ error: "BAD_REQUEST", message: "companyId es requerido" }, { status: 400 });
    }
    const rows = await listPurchaseOriginPhones(companyId);
    return NextResponse.json(rows);
}

export const GET = withAuth("create", "CodePurchase", handler);
