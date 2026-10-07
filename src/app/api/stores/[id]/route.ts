import { NextRequest, NextResponse } from "next/server";
import type { AuthenticatedActor } from "@/lib/auth/actor";
import { withAuth } from "@/lib/auth/guard";
import { AppError } from "@/lib/errors";
import { deleteStoreForActor } from "@/services/store.service";

async function handler(_req: NextRequest, context: { params: Promise<{ id: string }> }, _ability: unknown, actor: AuthenticatedActor) {
    try { const { id } = await context.params; await deleteStoreForActor(actor, id); return NextResponse.json({ success: true }); }
    catch (error) {
        if (error instanceof AppError) return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
        console.error("[stores/delete]", error); return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
    }
}
export const DELETE = withAuth("delete", "Store", handler);
