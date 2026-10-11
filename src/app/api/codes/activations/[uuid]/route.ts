import { NextRequest, NextResponse } from "next/server";

import { AppError } from "@/lib/errors";
import { withAuth } from "@/lib/auth/guard";
import {
    getActivationOrderForUser,
    retryActivationOrderForUser,
} from "@/services/self-service/fulfillment-orders.service";

type Actor = { id: string; role: string; companyId: string | null; storeId: string | null };

function errorResponse(error: unknown, fallback: string) {
    if (error instanceof AppError) {
        return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "INTERNAL", message: fallback }, { status: 500 });
}

async function handler(
    _req: NextRequest,
    context: { params: Promise<{ uuid: string }> },
    _ability: unknown,
    user: Actor,
) {
    try {
        const { uuid } = await context.params;
        // Solo lectura local. Diem avisa por webhook; no re-procesar contra Diem en cada poll.
        const purchase = await getActivationOrderForUser(user, decodeURIComponent(uuid));
        return NextResponse.json({ success: true, purchase });
    } catch (error) {
        return errorResponse(error, "No se pudo cargar la activación");
    }
}

export const GET = withAuth("read", "CodePurchase", handler);

async function retryHandler(
    _req: NextRequest,
    context: { params: Promise<{ uuid: string }> },
    _ability: unknown,
    user: Actor,
) {
    try {
        const { uuid } = await context.params;
        // Visibility is checked before any remote call or wallet finalization.
        const result = await retryActivationOrderForUser(user, decodeURIComponent(uuid));
        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        return errorResponse(error, "No se pudo consultar la activación en Diem");
    }
}

export const POST = withAuth("read", "CodePurchase", retryHandler);
