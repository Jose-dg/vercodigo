import type { NextRequest } from "next/server";

import { badRequest, forbidden } from "@/lib/errors";
import { resolveRange } from "@/lib/dashboard/range";
import type { AuthenticatedActor } from "@/lib/auth/actor";

/** Company and range of a dashboard request: own company, or ?companyId= for the platform. */
export function dashboardScope(req: NextRequest, user: AuthenticatedActor) {
    const params = req.nextUrl.searchParams;
    const isPlatform = user.role === "SUPER_ADMIN" || user.role === "SYSTEM_ADMIN";
    const companyId = isPlatform ? params.get("companyId") : user.companyId;
    if (!companyId) throw isPlatform ? badRequest("companyId es requerido") : forbidden("Usuario sin compañía asignada");
    try {
        return {
            companyId,
            range: resolveRange({ range: params.get("range"), from: params.get("from"), to: params.get("to") }),
        };
    } catch (error) {
        throw badRequest(error instanceof Error ? error.message : "Rango inválido");
    }
}
