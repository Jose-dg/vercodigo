import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/guard";
import { AppError } from "@/lib/errors";
import { deletePrice } from "@/services/pricing/pricing.service";

/**
 * DELETE /api/prices/[id] — elimina un precio configurado (scope validado en el servicio).
 */
async function deleteHandler(req: NextRequest, ctx: { params: { id: string } }, ability: any, user: any) {
    try {
        const result = await deletePrice(ctx.params.id, user);
        return NextResponse.json(result);
    } catch (e: any) {
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
