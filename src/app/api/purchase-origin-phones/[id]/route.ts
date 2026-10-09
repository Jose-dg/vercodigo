import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import type { AuthenticatedActor } from "@/lib/auth/actor";
import { withAuth } from "@/lib/auth/guard";
import { AppError } from "@/lib/errors";
import { updatePurchaseOriginPhone } from "@/services/purchases/purchase-origin-management.service";

const UpdateBody = z.object({
    phone: z.string().trim().min(1).max(32).optional(),
    label: z.string().trim().max(120).optional().nullable(),
    storeId: z.string().trim().min(1).optional().nullable(),
    isActive: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "No hay cambios para guardar");

async function handler(
    req: NextRequest,
    context: { params: Promise<{ id: string }> },
    _ability: unknown,
    actor: AuthenticatedActor,
) {
    try {
        const parsed = UpdateBody.safeParse(await req.json());
        if (!parsed.success) {
            return NextResponse.json({ error: "BAD_REQUEST", details: parsed.error.issues }, { status: 400 });
        }
        const { id } = await context.params;
        return NextResponse.json(await updatePurchaseOriginPhone({ actor, id, input: parsed.data }));
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
        }
        console.error("[purchase-origin-phone]", error);
        return NextResponse.json({ error: "INTERNAL", message: "Error inesperado" }, { status: 500 });
    }
}

export const PATCH = withAuth("manage", "Company", handler);
