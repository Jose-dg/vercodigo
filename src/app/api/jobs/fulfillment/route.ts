import { NextRequest, NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { checkDiemConnection, getDiemConfig } from "@/lib/devdiem/fulfillment";
import { processCodePurchase } from "@/services/self-service/purchase-codes.service";
import { processActivationJob } from "@/services/self-service/activate-card.service";

function isAuthorized(request: NextRequest) {
    const secret = process.env.CRON_SECRET;
    return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(request: NextRequest) {
    if (!isAuthorized(request)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        const config = getDiemConfig();
        const [remote, products] = await Promise.all([
            checkDiemConnection(),
            prisma.product.findMany({
                where: { isActive: true },
                select: {
                    id: true,
                    name: true,
                    devDiemProductId: true,
                    denominations: {
                        select: {
                            id: true,
                            amount: true,
                            currency: true,
                            devDiemProductId: true,
                        },
                    },
                },
                orderBy: { name: "asc" },
            }),
        ]);
        const unmapped: Array<{
            productId: string;
            product: string;
            denominationId: string | null;
            denomination?: string;
        }> = [];
        const configuredMappings = new Set<string>();
        for (const product of products) {
            if (!product.denominations.length) {
                if (!product.devDiemProductId) {
                    unmapped.push({
                        productId: product.id,
                        product: product.name,
                        denominationId: null,
                    });
                } else {
                    configuredMappings.add(product.devDiemProductId);
                }
                continue;
            }
            for (const denomination of product.denominations) {
                const mapping = denomination.devDiemProductId ?? product.devDiemProductId;
                if (mapping) {
                    configuredMappings.add(mapping);
                } else {
                    unmapped.push({
                    productId: product.id,
                    product: product.name,
                    denominationId: denomination.id,
                    denomination: `${denomination.amount} ${denomination.currency}`,
                    });
                }
            }
        }
        const remoteProductIds = new Set(remote.catalogProductIds);
        const unknownMappings = [...configuredMappings].filter(
            (productId) => !remoteProductIds.has(productId),
        );
        return NextResponse.json({
            ok: (
                remote.catalogProducts > 0
                && unmapped.length === 0
                && unknownMappings.length === 0
            ),
            diem: {
                connected: true,
                storeId: config.storeId,
                catalogProducts: remote.catalogProducts,
            },
            mappings: {
                ready: unmapped.length === 0 && unknownMappings.length === 0,
                unmapped,
                unknownProductIds: unknownMappings,
            },
        });
    } catch (error) {
        return NextResponse.json(
            {
                ok: false,
                diem: { connected: false },
                error: error instanceof Error ? error.message : "UNKNOWN",
            },
            { status: 503 },
        );
    }
}

export async function POST(request: NextRequest) {
    if (!isAuthorized(request)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const purchases = await prisma.codePurchase.findMany({
        where: {
            status: { in: ["PENDING", "AWAITING_STOCK"] },
            OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }],
            attempts: { lt: 20 },
        },
        orderBy: { createdAt: "asc" },
        take: 25,
        select: { id: true },
    });
    const results = [];
    for (const purchase of purchases) {
        try {
            const processed = await processCodePurchase(purchase.id);
            results.push({ id: purchase.id, status: processed.status });
        } catch (error) {
            results.push({
                id: purchase.id,
                status: "ERROR",
                error: error instanceof Error ? error.message : "UNKNOWN",
            });
        }
    }

    const activationJobs = await prisma.activationJob.findMany({
        where: {
            status: { in: ["PENDING", "PROCESSING", "AWAITING_STOCK"] },
            OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }],
            attempts: { lt: 20 },
        },
        orderBy: { createdAt: "asc" },
        take: 25,
        select: { id: true },
    });
    const activationResults = [];
    for (const job of activationJobs) {
        try {
            const processed = await processActivationJob(job.id);
            activationResults.push({ id: job.id, status: processed.status });
        } catch (error) {
            activationResults.push({
                id: job.id,
                status: "ERROR",
                error: error instanceof Error ? error.message : "UNKNOWN",
            });
        }
    }
    return NextResponse.json({
        purchases: { processed: results.length, results },
        activations: { processed: activationResults.length, results: activationResults },
    });
}
