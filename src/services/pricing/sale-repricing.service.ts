import crypto from "crypto";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { AppError, badGateway, badRequest, conflict, notFound, serviceUnavailable } from "@/lib/errors";
import { rebuildBalances } from "@/lib/wallet/ledger";
import { correctCodeRequestCommercialPrice, type DiemHttpError } from "@/lib/devdiem/fulfillment";
import { calculateCompanyRateAmount } from "@/lib/pricing/company-rate";
import { runSerializableTransaction } from "@/lib/prisma-transaction";

type Db = Prisma.TransactionClient | typeof prisma;
export type RepriceTargetType = "CODE_PURCHASE" | "CARD_ACTIVATION";

type Target = {
    targetType: RepriceTargetType;
    targetId: string;
    companyId: string;
    productId: string;
    productName: string;
    denominationAmount: number;
    quantity: number;
    oldTotal: number;
    oldRate: number;
    occurredAt: Date;
    occurredSequence: number;
    walletId: string;
    walletBalance: number;
    walletTransactionId: string;
    diemRequestId: string;
    statementIssued: boolean;
};

function money(value: number) {
    return Math.round(value * 100) / 100;
}

function fingerprint(target: Target, newRate: number) {
    return crypto.createHash("sha256").update(JSON.stringify({
        type: target.targetType,
        id: target.targetId,
        transactionId: target.walletTransactionId,
        oldTotal: money(target.oldTotal),
        oldRate: target.oldRate,
        newRate,
        occurredAt: target.occurredAt.toISOString(),
        occurredSequence: target.occurredSequence,
        statementIssued: target.statementIssued,
    })).digest("hex");
}

function remoteCorrectionError(error: unknown) {
    const remote = error as DiemHttpError;
    const correlationId = typeof remote?.correlationId === "string" ? remote.correlationId : undefined;
    const details = correlationId ? { correlationId } : undefined;
    const suffix = correlationId ? ` (correlación: ${correlationId})` : "";

    if (remote?.status === 409) {
        return conflict(`Diem detectó que el precio comercial cambió después de la vista previa${suffix}`, details);
    }
    if (remote?.status === 422) {
        return new AppError(
            `Diem rechazó la corrección comercial${suffix}`,
            422,
            "DIEM_VALIDATION",
            details,
        );
    }
    if (typeof remote?.status === "number" && remote.status >= 500) {
        return badGateway(`Diem no pudo procesar la corrección comercial${suffix}`, "DIEM_UNAVAILABLE", details);
    }
    if (error instanceof TypeError || typeof remote?.status !== "number") {
        return serviceUnavailable(`No fue posible comunicarse con Diem${suffix}`, "DIEM_UNREACHABLE", details);
    }
    return badGateway(`Diem rechazó la corrección comercial${suffix}`, "DIEM_REJECTED", details);
}

async function loadTarget(targetType: RepriceTargetType, targetId: string, db: Db = prisma): Promise<Target> {
    if (targetType === "CODE_PURCHASE") {
        const purchase = await db.codePurchase.findUnique({
            where: { id: targetId },
            include: { denomination: true },
        });
        if (!purchase || purchase.status !== "COMPLETED") throw notFound("Compra completada no encontrada");
        if (!purchase.denomination || purchase.denomination.currency !== "USD") {
            throw badRequest("La compra no tiene una denominación USD corregible");
        }
        if (!purchase.diemRequestId) throw conflict("La compra no tiene una solicitud asociada en Diem");
        const [transaction, product] = await Promise.all([
            db.walletTransaction.findFirst({
                where: { codePurchaseId: purchase.id, type: "CONSUMPTION", status: "CONFIRMED" },
                include: { wallet: true, accountStatementLine: true },
            }),
            db.product.findUnique({ where: { id: purchase.productId }, select: { name: true } }),
        ]);
        if (!transaction) throw conflict("La compra no tiene un consumo confirmado");
        return {
            targetType,
            targetId,
            companyId: purchase.companyId,
            productId: purchase.productId,
            productName: product?.name ?? "Producto",
            denominationAmount: purchase.denomination.amount,
            quantity: purchase.count,
            oldTotal: transaction.amount,
            oldRate: purchase.appliedExchangeRate
                ?? money(transaction.amount / (purchase.denomination.amount * purchase.count)),
            occurredAt: transaction.occurredAt,
            occurredSequence: transaction.occurredSequence,
            walletId: transaction.walletId,
            walletBalance: transaction.wallet.balance,
            walletTransactionId: transaction.id,
            diemRequestId: purchase.diemRequestId,
            statementIssued: Boolean(transaction.accountStatementLine),
        };
    }

    const activation = await db.cardActivation.findUnique({
        where: { id: targetId },
        include: {
            card: {
                include: {
                    product: { select: { id: true, name: true } },
                    denomination: true,
                    store: { select: { companyId: true } },
                    activationJobs: { orderBy: { createdAt: "desc" }, take: 1 },
                },
            },
        },
    });
    if (!activation?.card.denomination || activation.card.denomination.currency !== "USD") {
        throw notFound("Activación USD corregible no encontrada");
    }
    const job = activation.card.activationJobs[0];
    if (!job?.diemRequestId) throw conflict("La activación no tiene una solicitud asociada en Diem");
    const transaction = await db.walletTransaction.findFirst({
        where: { cardActivationId: activation.id, type: "CONSUMPTION", status: "CONFIRMED" },
        include: { wallet: true, accountStatementLine: true },
    });
    if (!transaction) throw conflict("La activación no tiene un consumo confirmado");
    return {
        targetType,
        targetId,
        companyId: activation.card.store.companyId,
        productId: activation.card.product.id,
        productName: activation.card.product.name,
        denominationAmount: activation.card.denomination.amount,
        quantity: 1,
        oldTotal: transaction.amount,
        oldRate: activation.appliedExchangeRate
            ?? money(transaction.amount / activation.card.denomination.amount),
        occurredAt: transaction.occurredAt,
        occurredSequence: transaction.occurredSequence,
        walletId: transaction.walletId,
        walletBalance: transaction.wallet.balance,
        walletTransactionId: transaction.id,
        diemRequestId: job.diemRequestId,
        statementIssued: Boolean(transaction.accountStatementLine),
    };
}

export async function listRepriceCandidates(params: { companyId: string; query?: string }) {
    const query = params.query?.trim();
    const dateMatch = query?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const dateStart = dateMatch ? new Date(`${dateMatch[0]}T00:00:00-05:00`) : null;
    const dateEnd = dateStart ? new Date(dateStart.getTime() + 24 * 60 * 60 * 1000) : null;
    const [matchingProducts, matchingUsers] = query && !dateMatch
        ? await Promise.all([
            prisma.product.findMany({
                where: { OR: [{ name: { contains: query, mode: "insensitive" } }, { brand: { contains: query, mode: "insensitive" } }] },
                select: { id: true },
            }),
            prisma.user.findMany({
                where: {
                    companyId: params.companyId,
                    OR: [{ name: { contains: query, mode: "insensitive" } }, { email: { contains: query, mode: "insensitive" } }],
                },
                select: { id: true },
            }),
        ])
        : [[], []];
    const productMatches = matchingProducts.map((product) => product.id);
    const userMatches = matchingUsers.map((user) => user.id);
    const [purchases, activations] = await Promise.all([
        prisma.codePurchase.findMany({
            where: {
                companyId: params.companyId,
                status: "COMPLETED",
                diemRequestId: { not: null },
                ...(dateStart && dateEnd ? { occurredAt: { gte: dateStart, lt: dateEnd } } : {}),
                ...(query && !dateMatch ? { OR: [
                    { id: { contains: query, mode: "insensitive" } },
                    { originLabelSnapshot: { contains: query, mode: "insensitive" } },
                    { productId: { in: productMatches } },
                    { userId: { in: userMatches } },
                ] } : {}),
            },
            include: { denomination: true },
            orderBy: { occurredAt: "desc" },
            take: 50,
        }),
        prisma.cardActivation.findMany({
            where: {
                card: { store: { companyId: params.companyId } },
                ...(dateStart && dateEnd ? { activatedAt: { gte: dateStart, lt: dateEnd } } : {}),
                ...(query && !dateMatch ? { OR: [
                    { id: { contains: query, mode: "insensitive" } },
                    { activatedBy: { contains: query, mode: "insensitive" } },
                    { card: { uuid: { contains: query, mode: "insensitive" } } },
                    { card: { productId: { in: productMatches } } },
                ] } : {}),
            },
            include: { card: { include: { product: true, denomination: true } } },
            orderBy: { activatedAt: "desc" },
            take: 50,
        }),
    ]);
    const productIds = [...new Set(purchases.map((p) => p.productId))];
    const products = await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true } });
    const names = new Map(products.map((p) => [p.id, p.name]));
    const transactions = await prisma.walletTransaction.findMany({
        where: {
            type: "CONSUMPTION",
            status: "CONFIRMED",
            OR: [
                { codePurchaseId: { in: purchases.map((purchase) => purchase.id) } },
                { cardActivationId: { in: activations.map((activation) => activation.id) } },
            ],
        },
        select: { amount: true, exchangeRate: true, codePurchaseId: true, cardActivationId: true },
    });
    const purchaseTransactions = new Map(transactions.filter((row) => row.codePurchaseId).map((row) => [row.codePurchaseId!, row]));
    const activationTransactions = new Map(transactions.filter((row) => row.cardActivationId).map((row) => [row.cardActivationId!, row]));
    return [
        ...purchases.filter((p) => p.denomination?.currency === "USD").map((p) => ({
            targetType: "CODE_PURCHASE" as const,
            targetId: p.id,
            occurredAt: p.occurredAt,
            productName: names.get(p.productId) ?? "Producto",
            denominationAmount: p.denomination!.amount,
            quantity: p.count,
            total: purchaseTransactions.get(p.id)?.amount ?? p.totalAmount,
            rate: p.appliedExchangeRate ?? purchaseTransactions.get(p.id)?.exchangeRate ?? null,
            reference: p.id,
        })),
        ...activations.filter((a) => a.card.denomination?.currency === "USD").map((a) => ({
            targetType: "CARD_ACTIVATION" as const,
            targetId: a.id,
            occurredAt: a.activatedAt,
            productName: a.card.product.name,
            denominationAmount: a.card.denomination!.amount,
            quantity: 1,
            total: activationTransactions.get(a.id)?.amount ?? a.commercialAmount,
            rate: a.appliedExchangeRate ?? activationTransactions.get(a.id)?.exchangeRate ?? null,
            reference: a.card.uuid,
        })),
    ].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime()).slice(0, 50);
}

export async function previewSaleReprice(params: {
    targetType: RepriceTargetType;
    targetId: string;
    newRate: number;
}) {
    if (!(params.newRate > 0) || !Number.isFinite(params.newRate)) throw badRequest("Tasa inválida");
    const target = await loadTarget(params.targetType, params.targetId);
    if (target.statementIssued) throw conflict("La venta ya pertenece a un estado de cuenta emitido");
    const calculated = calculateCompanyRateAmount({
        denominationUsd: target.denominationAmount,
        rateCopPerUsd: params.newRate,
        quantity: target.quantity,
    });
    const newUnitAmount = calculated.unitAmountCop;
    const newTotal = calculated.totalAmountCop;
    const delta = money(newTotal - target.oldTotal);
    const affectedMovements = await prisma.walletTransaction.count({
        where: {
            walletId: target.walletId,
            status: "CONFIRMED",
            OR: [
                { occurredAt: { gt: target.occurredAt } },
                { occurredAt: target.occurredAt, occurredSequence: { gt: target.occurredSequence } },
                { occurredAt: target.occurredAt, occurredSequence: target.occurredSequence, id: { gte: target.walletTransactionId } },
            ],
        },
    });
    return {
        ...target,
        newRate: params.newRate,
        oldUnitAmount: money(target.oldTotal / target.quantity),
        newUnitAmount,
        newTotal,
        delta,
        projectedBalance: money(target.walletBalance - delta),
        affectedMovements,
        fingerprint: fingerprint(target, params.newRate),
    };
}

export async function applySaleReprice(params: {
    targetType: RepriceTargetType;
    targetId: string;
    newRate: number;
    reason: string;
    fingerprint: string;
    idempotencyKey: string;
    actorId: string;
}) {
    const reason = params.reason.trim();
    if (reason.length < 3) throw badRequest("El motivo es obligatorio");
    let operation = await prisma.salePriceCorrection.findUnique({
        where: { idempotencyKey: params.idempotencyKey },
    });
    if (operation) {
        if (
            operation.targetType !== params.targetType
            || operation.targetId !== params.targetId
            || operation.newRate !== params.newRate
            || operation.reason !== reason
            || operation.fingerprint !== params.fingerprint
        ) {
            throw conflict("La clave idempotente ya fue utilizada con otra corrección");
        }
        if (operation.status === "COMPLETED") return operation;
    }
    const preview = await previewSaleReprice(params);
    if (preview.fingerprint !== params.fingerprint) throw conflict("La venta cambió después de la vista previa");
    if (!operation) {
        operation = await prisma.salePriceCorrection.findFirst({
            where: {
                targetType: params.targetType,
                targetId: params.targetId,
                newRate: params.newRate,
                fingerprint: params.fingerprint,
                status: { in: ["PENDING", "REMOTE_APPLIED", "FAILED"] },
            },
            orderBy: { createdAt: "desc" },
        });
    }
    if (operation) {
        if (operation.targetId !== params.targetId || operation.newRate !== params.newRate || operation.reason !== reason) {
            throw conflict("La clave idempotente ya fue utilizada con otra corrección");
        }
    } else {
        try {
            operation = await prisma.salePriceCorrection.create({
                data: {
                    idempotencyKey: params.idempotencyKey,
                    companyId: preview.companyId,
                    targetType: params.targetType,
                    targetId: params.targetId,
                    walletTransactionId: preview.walletTransactionId,
                    diemRequestId: preview.diemRequestId,
                    fingerprint: preview.fingerprint,
                    reason,
                    oldRate: preview.oldRate,
                    newRate: params.newRate,
                    oldTotal: preview.oldTotal,
                    newTotal: preview.newTotal,
                    actorId: params.actorId,
                },
            });
        } catch (error) {
            if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
            operation = await prisma.salePriceCorrection.findUniqueOrThrow({
                where: { idempotencyKey: params.idempotencyKey },
            });
            if (
                operation.targetType !== params.targetType
                || operation.targetId !== params.targetId
                || operation.newRate !== params.newRate
                || operation.reason !== reason
                || operation.fingerprint !== params.fingerprint
            ) {
                throw conflict("La clave idempotente ya fue utilizada con otra corrección");
            }
            if (operation.status === "COMPLETED") return operation;
        }
    }

    if (operation.status !== "REMOTE_APPLIED") {
        try {
            await correctCodeRequestCommercialPrice({
                requestId: preview.diemRequestId,
                idempotencyKey: `sale-reprice:${operation.id}`,
                expectedUnitPrice: preview.oldUnitAmount,
                expectedTotalAmount: preview.oldTotal,
                newUnitPrice: preview.newUnitAmount,
                newTotalAmount: preview.newTotal,
                currencyCode: "COP",
                reason,
                correlationId: `sale-reprice:${operation.id}`,
            });
            await prisma.salePriceCorrection.updateMany({
                where: { id: operation.id, status: { in: ["PENDING", "FAILED"] } },
                data: { status: "REMOTE_APPLIED", lastError: null },
            });
            operation = await prisma.salePriceCorrection.findUniqueOrThrow({ where: { id: operation.id } });
        } catch (error) {
            const mappedError = remoteCorrectionError(error);
            await prisma.salePriceCorrection.updateMany({
                where: { id: operation.id, status: { in: ["PENDING", "FAILED"] } },
                data: { status: "FAILED", lastError: mappedError.message.slice(0, 1000) },
            });
            const latest = await prisma.salePriceCorrection.findUnique({ where: { id: operation.id } });
            if (latest?.status === "COMPLETED") return latest;
            if (latest?.status === "REMOTE_APPLIED") {
                operation = latest;
            } else {
                throw mappedError;
            }
        }
    }

    return runSerializableTransaction(prisma, async (tx) => {
        const latestOperation = await tx.salePriceCorrection.findUniqueOrThrow({
            where: { id: operation.id },
        });
        if (latestOperation.status === "COMPLETED") return latestOperation;
        if (latestOperation.status !== "REMOTE_APPLIED") {
            throw conflict("Diem todavía no ha confirmado la corrección comercial");
        }
        const current = await loadTarget(params.targetType, params.targetId, tx);
        if (fingerprint(current, params.newRate) !== params.fingerprint) {
            throw conflict("La venta cambió después de sincronizar Diem; la corrección local requiere revisión");
        }
        const sourceAmount = money(current.denominationAmount * current.quantity);
        if (params.targetType === "CODE_PURCHASE") {
            await tx.codePurchase.update({
                where: { id: params.targetId },
                data: {
                    totalAmount: preview.newTotal,
                    currency: "COP",
                    sourceAmount,
                    sourceCurrency: "USD",
                    appliedExchangeRate: params.newRate,
                    billingUnitAmount: preview.newUnitAmount,
                },
            });
        } else {
            await tx.cardActivation.update({
                where: { id: params.targetId },
                data: {
                    commercialAmount: preview.newTotal,
                    commercialCurrency: "COP",
                    sourceAmount,
                    sourceCurrency: "USD",
                    appliedExchangeRate: params.newRate,
                },
            });
            await tx.activationJob.updateMany({
                where: { diemRequestId: current.diemRequestId },
                data: {
                    commercialAmount: preview.newUnitAmount,
                    commercialCurrency: "COP",
                    sourceAmount: current.denominationAmount,
                    sourceCurrency: "USD",
                    appliedExchangeRate: params.newRate,
                },
            });
        }
        await tx.walletTransaction.update({
            where: { id: current.walletTransactionId },
            data: {
                amount: preview.newTotal,
                originalAmount: sourceAmount,
                originalCurrency: "USD",
                exchangeRate: params.newRate,
            },
        });
        const rows = await tx.walletTransaction.findMany({
            where: { walletId: current.walletId },
            orderBy: [{ occurredAt: "asc" }, { occurredSequence: "asc" }, { id: "asc" }],
        });
        const rebuilt = rebuildBalances(rows.map((row) => ({
            id: row.id,
            type: row.type,
            status: row.status,
            amount: row.amount,
            occurredAt: row.occurredAt,
            occurredSequence: row.occurredSequence,
        })));
        for (const [id, balanceAfter] of rebuilt.balances) {
            await tx.walletTransaction.update({ where: { id }, data: { balanceAfter } });
        }
        await tx.wallet.update({ where: { id: current.walletId }, data: { balance: rebuilt.balance } });
        await tx.auditLog.create({
            data: {
                action: "SALE_PRICE_CORRECTED",
                userId: params.actorId,
                companyId: current.companyId,
                entityType: params.targetType,
                entityId: params.targetId,
                before: { rate: preview.oldRate, total: preview.oldTotal, walletBalance: preview.walletBalance },
                after: { rate: params.newRate, total: preview.newTotal, walletBalance: rebuilt.balance },
                details: { reason, correctionId: operation.id, diemRequestId: current.diemRequestId },
            },
        });
        return tx.salePriceCorrection.update({
            where: { id: operation.id },
            data: { status: "COMPLETED", completedAt: new Date(), lastError: null },
        });
    });
}
