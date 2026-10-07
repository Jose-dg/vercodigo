import { NextRequest, NextResponse } from "next/server";
import { BillingFrequency } from "@prisma/client";
import { z } from "zod";
import type { AuthenticatedActor } from "@/lib/auth/actor";
import { withAuth } from "@/lib/auth/guard";
import { AppError } from "@/lib/errors";
import { deleteCompanyForActor, getCompanyForActor, getCompanyStatsForActor, updateCompanyForActor } from "@/services/company.service";

const UpdateCompanyBody = z.object({
    name: z.string().trim().min(1).max(160).optional(), email: z.string().trim().email().optional(),
    phone: z.string().trim().min(1).max(40).optional(), address: z.string().trim().max(240).optional().nullable(),
    isActive: z.boolean().optional(), billingFrequency: z.nativeEnum(BillingFrequency).optional(),
    commissionRate: z.coerce.number().min(0).max(1).optional(),
}).strict();
function errorResponse(error: unknown) {
    if (error instanceof AppError) return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    console.error("[company]", error);
    return NextResponse.json({ error: "INTERNAL", message: "Error inesperado" }, { status: 500 });
}
async function getHandler(_req: NextRequest, context: { params: Promise<{ id: string }> }, _ability: unknown, actor: AuthenticatedActor) {
    try {
        const { id } = await context.params;
        const company = await getCompanyForActor(actor, id);
        if (!company) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
        return NextResponse.json({ company, stats: await getCompanyStatsForActor(actor, id) });
    } catch (error) { return errorResponse(error); }
}
async function putHandler(req: NextRequest, context: { params: Promise<{ id: string }> }, _ability: unknown, actor: AuthenticatedActor) {
    try {
        const parsed = UpdateCompanyBody.safeParse(await req.json());
        if (!parsed.success) return NextResponse.json({ error: "BAD_REQUEST", details: parsed.error.issues }, { status: 400 });
        const { id } = await context.params;
        return NextResponse.json(await updateCompanyForActor(actor, id, parsed.data));
    } catch (error) { return errorResponse(error); }
}
async function deleteHandler(_req: NextRequest, context: { params: Promise<{ id: string }> }, _ability: unknown, actor: AuthenticatedActor) {
    try { const { id } = await context.params; await deleteCompanyForActor(actor, id); return NextResponse.json({ success: true }); }
    catch (error) { return errorResponse(error); }
}
export const GET = withAuth("read", "Company", getHandler);
export const PUT = withAuth("update", "Company", putHandler);
export const DELETE = withAuth("delete", "Company", deleteHandler);
