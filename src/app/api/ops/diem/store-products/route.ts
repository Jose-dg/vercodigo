import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/guard";
import { isPlatformRole } from "@/lib/auth/abilities";
import { forbidden } from "@/lib/errors";
import { listOpsStoreProducts } from "@/lib/devdiem/ops";

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
    const ff = searchParams.get("fulfillment_enabled");
    const results = await listOpsStoreProducts({
        q: searchParams.get("q") ?? undefined,
        fulfillmentEnabled:
            ff === "true" ? true : ff === "false" ? false : null,
        missingSource: searchParams.get("missing_source") === "true",
    });
    return NextResponse.json({ results });
}

export const GET = withAuth("manage", "Product", handler);
