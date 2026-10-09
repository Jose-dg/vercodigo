import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withAuth } from "@/lib/auth/guard";
import type { AuthenticatedActor } from "@/lib/auth/actor";
import { AppError } from "@/lib/errors";
import {
    createPurchaseOriginPhone,
    listPurchaseOriginPhonesForActor,
} from "@/services/purchases/purchase-origin-management.service";

const CreateBody = z.object({
    companyId: z.string().trim().min(1),
    phone: z.string().trim().min(1).max(32),
    label: z.string().trim().max(120).optional().nullable(),
    storeId: z.string().trim().min(1).optional().nullable(),
}).strict();

function errorResponse(error: unknown) {
    if (error instanceof AppError) {
        return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    }
    console.error("[purchase-origin-phones]", error);
    return NextResponse.json({ error: "INTERNAL", message: "Error inesperado" }, { status: 500 });
}

async function getHandler(req: NextRequest, _ctx: unknown, _ability: unknown, actor: AuthenticatedActor) {
    try {
        return NextResponse.json(await listPurchaseOriginPhonesForActor({
            actor,
            companyId: req.nextUrl.searchParams.get("companyId"),
            includeInactive: req.nextUrl.searchParams.get("includeInactive") === "true",
        }));
    } catch (error) {
        return errorResponse(error);
    }
}

async function postHandler(req: NextRequest, _ctx: unknown, _ability: unknown, actor: AuthenticatedActor) {
    try {
        const parsed = CreateBody.safeParse(await req.json());
        if (!parsed.success) {
            return NextResponse.json({ error: "BAD_REQUEST", details: parsed.error.issues }, { status: 400 });
        }
        const { companyId, ...input } = parsed.data;
        return NextResponse.json(
            await createPurchaseOriginPhone({ actor, companyId, input }),
            { status: 201 },
        );
    } catch (error) {
        return errorResponse(error);
    }
}

export const GET = withAuth("create", "CodePurchase", getHandler);
export const POST = withAuth("manage", "Company", postHandler);
