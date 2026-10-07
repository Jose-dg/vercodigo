import { NextRequest, NextResponse } from "next/server";
import { BillingFrequency } from "@prisma/client";
import { z } from "zod";
import { withAuth } from "@/lib/auth/guard";
import type { AuthenticatedActor } from "@/lib/auth/actor";
import { AppError } from "@/lib/errors";
import { createCompanyForActor, getCompaniesForActor } from "@/services/company.service";

const CreateCompanyBody = z.object({
    name: z.string().trim().min(1).max(160), taxId: z.string().trim().min(1).max(40),
    email: z.string().trim().email(), phone: z.string().trim().min(1).max(40),
    address: z.string().trim().max(240).optional().nullable(), billingFrequency: z.nativeEnum(BillingFrequency),
    commissionRate: z.coerce.number().min(0).max(1),
});

function errorResponse(error: unknown) {
    if (error instanceof AppError) return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    console.error("[companies]", error);
    return NextResponse.json({ error: "INTERNAL", message: "Error inesperado" }, { status: 500 });
}
async function listHandler(_req: NextRequest, _ctx: unknown, _ability: unknown, actor: AuthenticatedActor) {
    try { return NextResponse.json(await getCompaniesForActor(actor)); } catch (error) { return errorResponse(error); }
}
async function createHandler(req: NextRequest, _ctx: unknown, _ability: unknown, actor: AuthenticatedActor) {
    try {
        const parsed = CreateCompanyBody.safeParse(await req.json());
        if (!parsed.success) return NextResponse.json({ error: "BAD_REQUEST", details: parsed.error.issues }, { status: 400 });
        return NextResponse.json(await createCompanyForActor(actor, parsed.data), { status: 201 });
    } catch (error) { return errorResponse(error); }
}
export const GET = withAuth("read", "Company", listHandler);
export const POST = withAuth("create", "Company", createHandler);
