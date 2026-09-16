import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/guard";
import { isPlatformRole } from "@/lib/auth/abilities";
import { forbidden } from "@/lib/errors";
import { listOpsClients } from "@/lib/devdiem/ops";

async function handler(
    req: NextRequest,
    _ctx: unknown,
    _ability: unknown,
    user: { role: string },
) {
    if (!isPlatformRole(user.role as "SUPER_ADMIN" | "SYSTEM_ADMIN")) {
        throw forbidden("Solo plataforma puede usar Ops Diem");
    }
    const { searchParams } = req.nextUrl;
    const results = await listOpsClients({
        q: searchParams.get("q") ?? undefined,
        status: (searchParams.get("status") as
            | "unclassified"
            | "needs_account"
            | "operable"
            | "all"
            | null) ?? "unclassified",
    });
    return NextResponse.json({ results });
}

export const GET = withAuth("manage", "Product", handler);
