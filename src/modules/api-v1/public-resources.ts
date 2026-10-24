import "server-only";

import type { Prisma } from "@prisma/client";

import prisma from "@/lib/prisma";
import { notFound } from "@/lib/errors";
import { getOrCreateWallet } from "@/services/wallet/wallet.service";
import { serializeDelivery, serializeSandboxDelivery } from "./serializers";

type CursorParams = { limit: number; startingAfter: string | null };
type PublicOrder = ReturnType<typeof serializeDelivery> | ReturnType<typeof serializeSandboxDelivery>;

const descendingCursor = (row: { occurredAt: Date; occurredSequence: number; id: string }) => ({
    OR: [
        { occurredAt: { lt: row.occurredAt } },
        { occurredAt: row.occurredAt, occurredSequence: { lt: row.occurredSequence } },
        { occurredAt: row.occurredAt, occurredSequence: row.occurredSequence, id: { lt: row.id } },
    ],
});

const createdCursor = (row: { createdAt: Date; id: string }) => ({
    OR: [
        { createdAt: { lt: row.createdAt } },
        { createdAt: row.createdAt, id: { lt: row.id } },
    ],
});

export async function listPublicOrders(
    companyId: string,
    environment: "LIVE" | "SANDBOX",
    params: CursorParams,
): Promise<PublicOrder[]> {
    if (environment === "SANDBOX") {
        const cursor = params.startingAfter
            ? await prisma.sandboxDelivery.findFirst({
                where: { id: params.startingAfter, companyId },
                select: { id: true, createdAt: true },
            })
            : null;
        if (params.startingAfter && !cursor) throw notFound("Cursor no encontrado");
        const rows = await prisma.sandboxDelivery.findMany({
            where: { companyId, ...(cursor ? createdCursor(cursor) : {}) },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: params.limit + 1,
        });
        const products = await prisma.product.findMany({
            where: { id: { in: [...new Set(rows.map((row) => row.productId))] } },
            select: { id: true, name: true },
        });
        const names = new Map(products.map((product) => [product.id, product.name]));
        return rows.map((row) => serializeSandboxDelivery(row, names.get(row.productId)));
    }

    const cursor = params.startingAfter
        ? await prisma.codePurchase.findFirst({
            where: { id: params.startingAfter, companyId },
            select: { id: true, occurredAt: true, occurredSequence: true },
        })
        : null;
    if (params.startingAfter && !cursor) throw notFound("Cursor no encontrado");
    const rows = await prisma.codePurchase.findMany({
        where: { companyId, ...(cursor ? descendingCursor(cursor) : {}) },
        orderBy: [{ occurredAt: "desc" }, { occurredSequence: "desc" }, { id: "desc" }],
        take: params.limit + 1,
    });
    const products = await prisma.product.findMany({
        where: { id: { in: [...new Set(rows.map((row) => row.productId))] } },
        select: { id: true, name: true },
    });
    const names = new Map(products.map((product) => [product.id, product.name]));
    return rows.map((row) => serializeDelivery({ ...row, productName: names.get(row.productId) }));
}

export function serializeWalletTransaction(row: {
    id: string;
    type: string;
    status: string;
    amount: number;
    balanceAfter: number | null;
    description: string | null;
    externalReference: string | null;
    occurredAt: Date;
    createdAt: Date;
}, currency: string) {
    return {
        id: row.id,
        object: "transaction" as const,
        type: row.type.toLowerCase(),
        status: row.status.toLowerCase(),
        amount: { amount: row.amount, currency },
        balance_after: row.balanceAfter === null ? null : { amount: row.balanceAfter, currency },
        description: row.description,
        external_reference: row.externalReference,
        occurred_at: row.occurredAt.toISOString(),
        created_at: row.createdAt.toISOString(),
    };
}

async function publicTransactionWhere(walletId: string): Promise<Prisma.WalletTransactionWhereInput> {
    const opening = await prisma.walletTransaction.findFirst({
        where: { walletId, type: "OPENING_BALANCE", status: "CONFIRMED" },
        orderBy: [{ occurredAt: "desc" }, { occurredSequence: "desc" }, { id: "desc" }],
        select: { occurredAt: true, occurredSequence: true, id: true },
    });
    return {
        walletId,
        status: { in: ["CONFIRMED", "PENDING"] },
        ...(opening ? {
            OR: [
                { occurredAt: { gt: opening.occurredAt } },
                { occurredAt: opening.occurredAt, occurredSequence: { gt: opening.occurredSequence } },
                {
                    occurredAt: opening.occurredAt,
                    occurredSequence: opening.occurredSequence,
                    id: { gte: opening.id },
                },
            ],
        } : {}),
    };
}

export async function listPublicTransactions(companyId: string, params: CursorParams) {
    const wallet = await getOrCreateWallet(companyId);
    const visibleWhere = await publicTransactionWhere(wallet.id);
    const cursor = params.startingAfter
        ? await prisma.walletTransaction.findFirst({
            where: { AND: [visibleWhere, { id: params.startingAfter }] },
            select: { id: true, occurredAt: true, occurredSequence: true },
        })
        : null;
    if (params.startingAfter && !cursor) throw notFound("Cursor no encontrado");
    const rows = await prisma.walletTransaction.findMany({
        where: { AND: [visibleWhere, ...(cursor ? [descendingCursor(cursor)] : [])] },
        orderBy: [{ occurredAt: "desc" }, { occurredSequence: "desc" }, { id: "desc" }],
        take: params.limit + 1,
    });
    return rows.map((row) => serializeWalletTransaction(row, wallet.currency));
}

export async function getPublicTransaction(companyId: string, id: string) {
    const wallet = await getOrCreateWallet(companyId);
    const visibleWhere = await publicTransactionWhere(wallet.id);
    const row = await prisma.walletTransaction.findFirst({
        where: { AND: [visibleWhere, { id }] },
    });
    if (!row) throw notFound("Transacción no encontrada");
    return serializeWalletTransaction(row, wallet.currency);
}
