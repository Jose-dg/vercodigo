import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { AuthenticatedActor } from "@/lib/auth/actor";
import { withAuth } from "@/lib/auth/guard";
import { AppError } from "@/lib/errors";
import { createStoreForActor, getStoresForActor } from "@/services/store.service";

const StoreBody = z.object({
    companyId: z.string().min(1).optional(), name: z.string().trim().min(3).max(160),
    address: z.string().trim().min(3).max(240), phone: z.string().trim().min(7).max(40),
});
function respond(error: unknown) {
    if (error instanceof AppError) return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    console.error("[stores]", error); return NextResponse.json({ error: "INTERNAL", message: "Error inesperado" }, { status: 500 });
}
async function getHandler(_req: NextRequest, _ctx: unknown, _ability: unknown, actor: AuthenticatedActor) {
    try { return NextResponse.json(await getStoresForActor(actor)); } catch (error) { return respond(error); }
}
async function postHandler(req: NextRequest, _ctx: unknown, _ability: unknown, actor: AuthenticatedActor) {
    try {
        const parsed = StoreBody.safeParse(await req.json());
        if (!parsed.success) return NextResponse.json({ error: "BAD_REQUEST", details: parsed.error.issues }, { status: 400 });
        return NextResponse.json(await createStoreForActor(actor, parsed.data), { status: 201 });
    } catch (error) { return respond(error); }
}
export const GET = withAuth("read", "Store", getHandler);
export const POST = withAuth("create", "Store", postHandler);
