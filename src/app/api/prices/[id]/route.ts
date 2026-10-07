import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/guard";
import { AppError } from "@/lib/errors";
import { deletePrice } from "@/services/pricing/pricing.service";
import type { AuthenticatedActor } from "@/lib/auth/actor";

/**
 * DELETE /api/prices/[id] — elimina un precio configurado (scope validado en el servicio).
 */
async function deleteHandler(_req: NextRequest, ctx: { params: Promise<{ id: string }> }, _ability: unknown, user: AuthenticatedActor) {
    try {
        const { id } = await ctx.params;
        const result = await deletePrice(id, user);
        return NextResponse.json(result);
    } catch (e: unknown) {
        if (e instanceof AppError) {
            return NextResponse.json(
                { error: e.code, message: e.message, details: e.details },
                { status: e.status }
            );
        }
        console.error("[prices/delete] Error:", e);
        return NextResponse.json({ error: "INTERNAL", message: "Error inesperado" }, { status: 500 });
    }
}

export const DELETE = withAuth("delete", "CompanyProductPrice", deleteHandler);
