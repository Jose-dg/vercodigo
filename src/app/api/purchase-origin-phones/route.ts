import { NextRequest, NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth/guard";

async function handler(req: NextRequest, _ctx: unknown, _ability: unknown, user: any) {
    const isPlatform = user.role === "SUPER_ADMIN" || user.role === "SYSTEM_ADMIN";
    const companyId = isPlatform
        ? req.nextUrl.searchParams.get("companyId")?.trim()
        : user.companyId;
    if (!companyId) {
        return NextResponse.json({ error: "BAD_REQUEST", message: "companyId es requerido" }, { status: 400 });
    }
    const rows = await prisma.purchaseOriginPhone.findMany({
        where: { companyId, isActive: true },
        select: { id: true, phone: true, label: true, storeId: true },
        orderBy: [{ label: "asc" }, { phone: "asc" }],
    });
    return NextResponse.json(rows);
}

export const GET = withAuth("create", "CodePurchase", handler);
