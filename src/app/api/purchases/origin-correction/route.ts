import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withAuth } from "@/lib/auth/guard";
import { AppError } from "@/lib/errors";
import type { AuthenticatedActor } from "@/lib/auth/actor";
import {
    applyPurchaseOriginCorrection,
    listPurchaseOriginCorrectionData,
} from "@/services/purchases/purchase-origin-correction.service";

const Body = z.object({
    purchaseId: z.string().min(1),
    origin: z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("phone"), id: z.string().min(1) }),
        z.object({ kind: z.literal("store"), id: z.string().min(1) }),
    ]),
    reason: z.string().trim().min(3).max(500),
});

function errorResponse(error: unknown) {
    if (error instanceof AppError) {
        return NextResponse.json({ error: error.code, message: error.message, details: error.details }, { status: error.status });
    }
    console.error("[purchases/origin-correction]", error);
    return NextResponse.json({ error: "INTERNAL", message: "No se pudo corregir el origen" }, { status: 500 });
}

async function getHandler(req: NextRequest, _ctx: unknown, _ability: unknown, actor: AuthenticatedActor) {
    try {
        const companyId = req.nextUrl.searchParams.get("companyId")?.trim();
        if (!companyId) return NextResponse.json({ error: "companyId es requerido" }, { status: 400 });
        const data = await listPurchaseOriginCorrectionData({
            actor,
            companyId,
            query: req.nextUrl.searchParams.get("query") ?? undefined,
        });
        return NextResponse.json(data);
    } catch (error) {
        return errorResponse(error);
    }
}

async function postHandler(req: NextRequest, _ctx: unknown, _ability: unknown, actor: AuthenticatedActor) {
    try {
        const parsed = Body.safeParse(await req.json());
        if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
        const idempotencyKey = req.headers.get("Idempotency-Key")?.trim();
        if (!idempotencyKey || idempotencyKey.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(idempotencyKey)) {
            return NextResponse.json({ error: "Idempotency-Key inválida" }, { status: 400 });
        }
        const correction = await applyPurchaseOriginCorrection({
            actor,
            ...parsed.data,
            idempotencyKey,
        });
        return NextResponse.json({ success: true, correction });
    } catch (error) {
        return errorResponse(error);
    }
}

export const GET = withAuth("manage", "ProductCost", getHandler);
export const POST = withAuth("manage", "ProductCost", postHandler);
