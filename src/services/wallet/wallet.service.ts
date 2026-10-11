import prisma from "@/lib/prisma";
import {
    walletMovementDescription,
    walletPurchaseDescription,
    walletPurchaseOriginDescription,
} from "@/lib/wallet/presentation";
import { Prisma, WalletRechargeMethod } from "@prisma/client";
import { badRequest, conflict, notFound } from "@/lib/errors";

// Cliente Prisma normal o transaccional: todas las funciones de este servicio
// aceptan `tx` para poder ejecutarse dentro de la $transaction del flujo llamador
// (activación de tarjeta / compra de códigos) y mantener el débito atómico.
type Db = Prisma.TransactionClient | typeof prisma;

export async function getOrCreateWallet(companyId: string, tx: Db = prisma) {
    const existing = await tx.wallet.findUnique({ where: { companyId } });
    if (existing) return existing;
    return tx.wallet.create({ data: { companyId } });
}

/**
 * Tasa de conversión entre monedas, leída de SystemConfig (key FX_<from>_<to>,
 * ej. FX_USD_COP). Devuelve null si no está configurada — el llamador decide
 * qué hacer (debit registra la transacción como PENDING, nunca bloquea).
 */
export async function getFxRate(from: string, to: string, tx: Db = prisma): Promise<number | null> {
    if (from === to) return 1;
    const config = await tx.systemConfig.findUnique({ where: { key: `FX_${from}_${to}` } });
    const rate = config ? parseFloat(config.value) : NaN;
    return Number.isFinite(rate) && rate > 0 ? rate : null;
}

/**
 * Descuenta consumo de la wallet de una compañía. Reglas de producción:
 * - El balance puede quedar negativo (negativo = deuda). Nunca bloquea la venta.
 * - Si no hay tasa FX configurada para la moneda de la wallet, registra la
 *   transacción como PENDING (monto 0, balance intacto, monto original guardado)
 *   para que la plataforma la reprecie después desde el dashboard.
 * - Monto <= 0: no registra nada.
 */
export async function debit(params: {
    companyId: string;
    amount: number;
    currency: string;
    description?: string;
    createdById?: string | null;
    cardActivationId?: string;
    codePurchaseId?: string;
    sourceAmount?: number;
    sourceCurrency?: string;
    appliedExchangeRate?: number;
    tx?: Db;
}) {
    const { companyId, amount, currency, tx = prisma } = params;
    if (!(amount > 0)) return null;

    const wallet = await getOrCreateWallet(companyId, tx);
    const rate = params.appliedExchangeRate
        ?? await getFxRate(currency, wallet.currency, tx);

    if (rate === null) {
        return tx.walletTransaction.create({
            data: {
                walletId: wallet.id,
                type: "CONSUMPTION",
                status: "PENDING",
                amount: 0,
                originalAmount: params.sourceAmount ?? amount,
                originalCurrency: params.sourceCurrency ?? currency,
                description:
                    params.description ??
                    `Consumo pendiente de tasa FX_${currency}_${wallet.currency}`,
                createdById: params.createdById ?? null,
                cardActivationId: params.cardActivationId,
                codePurchaseId: params.codePurchaseId,
                occurredAt: new Date(),
            },
        });
    }

    const converted = params.appliedExchangeRate != null
        ? amount
        : amount * rate;
    const updated = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: converted } },
    });

    return tx.walletTransaction.create({
        data: {
            walletId: wallet.id,
            type: "CONSUMPTION",
            status: "CONFIRMED",
            amount: converted,
            balanceAfter: updated.balance,
            originalAmount: params.sourceAmount ?? amount,
            originalCurrency: params.sourceCurrency ?? currency,
            exchangeRate: rate,
            description: params.description,
            createdById: params.createdById ?? null,
            cardActivationId: params.cardActivationId,
            codePurchaseId: params.codePurchaseId,
            occurredAt: new Date(),
        },
    });
}

/**
 * Reverses one CONSUMPTION when Diem cancels a delivery that was already
 * billed. A CONFIRMED consumption is refunded with a REFUND movement linked by
 * reversalOfId (unique: the database rejects a second reversal); a PENDING one
 * never touched the balance, so it is marked FAILED. Runs inside the caller's
 * transaction together with the order's status change.
 */
export async function reverseConsumption(params: {
    consumptionId: string;
    description: string;
    createdById?: string | null;
    tx: Db;
}) {
    const { tx } = params;
    const consumption = await tx.walletTransaction.findUniqueOrThrow({ where: { id: params.consumptionId } });
    if (consumption.type !== "CONSUMPTION") {
        throw new Error(`El movimiento ${consumption.id} no es un consumo`);
    }
    if (consumption.status === "FAILED") return null;
    if (consumption.status === "PENDING") {
        await tx.walletTransaction.update({
            where: { id: consumption.id },
            data: { status: "FAILED", description: `${consumption.description ?? "Consumo"} · anulado` },
        });
        return null;
    }
    const updated = await tx.wallet.update({
        where: { id: consumption.walletId },
        data: { balance: { increment: consumption.amount } },
    });
    return tx.walletTransaction.create({
        data: {
            walletId: consumption.walletId,
            type: "REFUND",
            status: "CONFIRMED",
            amount: consumption.amount,
            balanceAfter: updated.balance,
            originalAmount: consumption.originalAmount,
            originalCurrency: consumption.originalCurrency,
            exchangeRate: consumption.exchangeRate,
            description: params.description,
            createdById: params.createdById ?? null,
            reversalOfId: consumption.id,
            occurredAt: new Date(),
        },
    });
}

/**
 * Registra un abono a la wallet (hoy: solo manual, tras confirmar un pago
 * externo como una transferencia). La autorización de plataforma se valida en
 * la ruta; el servicio solo asume que el actor está autorizado.
 */
export async function recharge(params: {
    companyId: string;
    amount: number;
    method?: WalletRechargeMethod;
    externalReference?: string;
    description?: string;
    actorId: string;
}) {
    if (!(params.amount > 0)) throw badRequest("El monto del abono debe ser mayor a 0");

    return prisma.$transaction(async (tx) => {
        const wallet = await getOrCreateWallet(params.companyId, tx);
        const updated = await tx.wallet.update({
            where: { id: wallet.id },
            data: { balance: { increment: params.amount } },
        });

        return tx.walletTransaction.create({
            data: {
                walletId: wallet.id,
                type: "RECHARGE",
                status: "CONFIRMED",
                method: params.method ?? "MANUAL",
                amount: params.amount,
                balanceAfter: updated.balance,
                externalReference: params.externalReference,
                description: params.description,
                createdById: params.actorId,
                occurredAt: new Date(),
            },
        });
    });
}

/**
 * Cambia la moneda de la wallet. Solo permitido con balance exactamente en 0
 * para no reinterpretar saldo existente en otra moneda.
 */
export async function changeCurrency(params: { companyId: string; newCurrency: string }) {
    const currency = params.newCurrency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) throw badRequest("Moneda inválida (código ISO de 3 letras)");

    const wallet = await prisma.wallet.findUnique({ where: { companyId: params.companyId } });
    if (!wallet) throw notFound("Wallet no encontrada");
    if (wallet.balance !== 0)
        throw conflict("Solo se puede cambiar la moneda con el balance en 0", {
            balance: wallet.balance,
            currency: wallet.currency,
        });

    return prisma.wallet.update({ where: { id: wallet.id }, data: { currency } });
}

/**
 * Vista de plataforma: todas las compañías con su balance (deuda si negativo)
 * y cuántas transacciones PENDING (sin tasa FX) tienen por resolver.
 */
export async function getWalletSummaries() {
    const companies = await prisma.company.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: {
            id: true,
            name: true,
            wallet: {
                select: {
                    id: true,
                    currency: true,
                    balance: true,
                    updatedAt: true,
                    _count: { select: { transactions: { where: { status: "PENDING" } } } },
                },
            },
        },
    });

    return companies.map((c) => ({
        companyId: c.id,
        companyName: c.name,
        currency: c.wallet?.currency ?? "COP",
        balance: c.wallet?.balance ?? 0,
        pendingTransactions: c.wallet?._count.transactions ?? 0,
        updatedAt: c.wallet?.updatedAt ?? null,
    }));
}

/**
 * Vista de compañía (OWNER/GENERAL_ADMIN): su wallet + movimientos paginados.
 */
export async function getWalletForCompany(companyId: string, opts?: { page?: number; pageSize?: number }) {
    const page = Math.max(1, opts?.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, opts?.pageSize ?? 25));

    const wallet = await getOrCreateWallet(companyId);
    const opening = await prisma.walletTransaction.findFirst({
        where: { walletId: wallet.id, type: "OPENING_BALANCE", status: "CONFIRMED" },
        orderBy: [{ occurredAt: "desc" }, { occurredSequence: "desc" }, { id: "desc" }],
        select: { occurredAt: true, occurredSequence: true, id: true },
    });
    // FAILED se conserva en DB por auditoría (reclasificaciones) pero no se
    // muestra al cliente: solo CONFIRMED y PENDING (FX pendiente).
    const visibleWhere = {
        walletId: wallet.id,
        status: { in: ["CONFIRMED", "PENDING"] as ("CONFIRMED" | "PENDING")[] },
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
    const [transactions, total] = await Promise.all([
        prisma.walletTransaction.findMany({
            where: visibleWhere,
            orderBy: [{ occurredAt: "desc" }, { occurredSequence: "desc" }, { id: "desc" }],
            skip: (page - 1) * pageSize,
            take: pageSize,
        }),
        prisma.walletTransaction.count({ where: visibleWhere }),
    ]);

    const purchaseIds = transactions.flatMap((transaction) =>
        transaction.codePurchaseId ? [transaction.codePurchaseId] : []
    );
    const purchases = purchaseIds.length
        ? await prisma.codePurchase.findMany({
            where: {
                id: { in: purchaseIds },
                companyId,
            },
            select: {
                id: true,
                count: true,
                productId: true,
                storeId: true,
                idempotencyKey: true,
                originLabelSnapshot: true,
                purchaseOriginPhone: {
                    select: { phone: true, companyId: true },
                },
            },
        })
        : [];
    const productIds = [...new Set(purchases.map((purchase) => purchase.productId))];
    const storeIds = [...new Set(purchases.flatMap((purchase) => purchase.storeId ? [purchase.storeId] : []))];
    const [products, stores] = await Promise.all([
        productIds.length
            ? prisma.product.findMany({
                where: { id: { in: productIds } },
                select: { id: true, name: true },
            })
            : [],
        storeIds.length
            ? prisma.store.findMany({
                where: { id: { in: storeIds }, companyId },
                select: { id: true, name: true },
            })
            : [],
    ]);
    const purchaseMap = new Map(purchases.map((purchase) => [purchase.id, purchase]));
    const productMap = new Map(products.map((product) => [product.id, product.name]));
    const storeMap = new Map(stores.map((store) => [store.id, store.name]));
    const presentedTransactions = transactions.map((transaction) => {
        const purchase = transaction.codePurchaseId
            ? purchaseMap.get(transaction.codePurchaseId)
            : undefined;
        const isHistoricalPurchase = purchase?.idempotencyKey.startsWith("history:blue-panther:") ?? false;
        const isHistoricalRecharge = transaction.id.startsWith("bp-hist-wallet-recharge-");
        const historicalAction = isHistoricalPurchase ? "Buy" : isHistoricalRecharge ? "Payment" : null;
        const productName = purchase ? productMap.get(purchase.productId) : undefined;
        const displayDescription = historicalAction
            ? walletMovementDescription({
                description: transaction.description,
                externalReference: transaction.externalReference,
                historicalAction,
                historicalBuyerName: "Blue Panther",
            })
            : purchase && productName
                ? walletPurchaseDescription(purchase.count, productName)
                : walletMovementDescription({
                    description: transaction.description,
                    externalReference: transaction.externalReference,
                });
        const hasValidPhoneOrigin = purchase?.purchaseOriginPhone?.companyId === companyId;
        const validStoreName = purchase?.storeId ? storeMap.get(purchase.storeId) : undefined;

        return {
            ...transaction,
            displayDescription,
            originDescription: purchase
                ? walletPurchaseOriginDescription({
                    phone: hasValidPhoneOrigin ? purchase.purchaseOriginPhone?.phone : null,
                    label: hasValidPhoneOrigin || validStoreName
                        ? purchase.originLabelSnapshot
                        : null,
                    storeName: validStoreName,
                })
                : null,
        };
    });

    return { wallet, transactions: presentedTransactions, pagination: { page, pageSize, total } };
}
