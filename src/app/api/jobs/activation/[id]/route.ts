import { NextRequest, NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth/guard";
import { processActivationJob } from "@/services/self-service/activate-card.service";
import { isFulfillmentWaitLocal } from "@/services/self-service/fulfillment-lifecycle";

async function handler(
    _request: NextRequest,
    context: { params: Promise<{ id: string }> },
    _ability: unknown,
    user: { id: string },
) {
    const { id } = await context.params;
    // Solo lectura local. El avance lo dispara el webhook Diem → /api/webhook/fulfillment.
    const owned = await prisma.activationJob.findFirst({
        where: { id, userId: user.id },
        include: {
            card: {
                include: {
                    product: true,
                    store: true,
                    activation: true,
                },
            },
        },
    });
    if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({
        success: owned.status === "COMPLETED",
        processing: !isFulfillmentWaitLocal(owned.status),
        jobId: owned.id,
        status: owned.status,
        lastError: owned.lastError,
        nextRetryAt: owned.nextRetryAt,
        fulfillmentStatus: owned.fulfillmentStatus,
        diemRequestId: owned.diemRequestId,
        ...(owned.status === "COMPLETED" && owned.card.activation
            ? {
                activation: {
                    id: owned.card.activation.id,
                    activatedAt: owned.card.activation.activatedAt,
                },
                card: {
                    uuid: owned.card.uuid,
                    product: owned.card.product.name,
                    store: owned.card.store.name,
                },
            }
            : {}),
    });
}

export const GET = withAuth("read", "Card", handler);

async function retryHandler(
    _request: NextRequest,
    context: { params: Promise<{ id: string }> },
    _ability: unknown,
    user: { id: string },
) {
    const { id } = await context.params;
    const owned = await prisma.activationJob.findFirst({
        where: { id, userId: user.id },
        select: {
            id: true,
        },
    });
    if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });
    try {
        const result = await processActivationJob(owned.id);
        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        return NextResponse.json(
            {
                success: false,
                error: "FULFILLMENT_RETRY_FAILED",
                message: error instanceof Error ? error.message : "No se pudo consultar Diem",
            },
            { status: 409 },
        );
    }
}

export const POST = withAuth("read", "Card", retryHandler);
