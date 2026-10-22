import { NextRequest, NextResponse } from "next/server";

import { AppError } from "@/lib/errors";
import { withAuth } from "@/lib/auth/guard";
import type { AppAbility } from "@/lib/auth/abilities";
import type { AuthenticatedActor } from "@/lib/auth/actor";
import { getCompanyDashboard } from "@/services/company/dashboard.service";
import { dashboardScope } from "./scope";

/** GET /api/company/dashboard?range=7d|30d|all|period&from=&to= — company home. */
export const GET = withAuth("read", "Company", async (
    req: NextRequest,
    _ctx: unknown,
    _ability: AppAbility,
    user: AuthenticatedActor,
) => {
    try {
        const { companyId, range } = dashboardScope(req, user);
        return NextResponse.json(await getCompanyDashboard(companyId, range));
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
        }
        console.error("[company/dashboard]", error);
        return NextResponse.json({ error: "INTERNAL", message: "Error inesperado" }, { status: 500 });
    }
});
