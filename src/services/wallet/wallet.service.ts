import prisma from "@/lib/prisma";
import {
    walletMovementDescription,
    walletPurchaseDescription,
    walletPurchaseOriginDescription,
} from "@/lib/wallet/presentation";
import { Prisma, WalletRechargeMethod } from "@prisma/client";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { runSerializableTransaction } from "@/lib/prisma-transaction";
import {
    effectiveTimeLabel,
    effectiveTimeProblem,
    normalizeBankReference,
    type WalletTimeSource,
} from "@/lib/wallet/effective-time";
import type { WalletMovementFilters } from "@/lib/wallet/movement-query";
import { assertOpenPeriod, rebuildWalletLedger } from "./ledger-write";

// Cliente Prisma normal o transaccional: todas las funciones de este servicio
// aceptan `tx` para poder ejecutarse dentro de la $transaction del flujo llamador
// (activación de tarjeta / compra de códigos) y mantener el débito atómico.
type Db = Prisma.TransactionClient | typeof prisma;

export async function getOrCreateWallet(companyId: string, tx: Db = prisma) {
    const existing = await tx.wallet.findUnique({ where: { companyId } });
    if (existing) return existing;
    // Two concurrent first reads (e.g. overview + balance indicator) would both
    // try to create it. ON CONFLICT DO NOTHING (skipDuplicates) avoids the
    // unique violation, which inside a caller's transaction would abort it.
    await tx.wallet.createMany({ data: [{ companyId }], skipDuplicates: true });
    return tx.wallet.findUniqueOrThrow({ where: { companyId } });
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
                occurredAtSource: "LEDGER_EVENT",
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
            occurredAtSource: "LEDGER_EVENT",
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
            occurredAtSource: "LEDGER_EVENT",
        },
    });
}

export type RechargeTimeSource = Extract<WalletTimeSource, "PAYMENT" | "GATEWAY_CONFIRMATION">;

/**
 * Registra un abono a la wallet tras confirmar el pago externo. La autorización
 * de plataforma se valida en la ruta.
 *
 * - `occurredAt` es cuándo ocurrió o se confirmó el pago, nunca la hora de
 *   registro (`createdAt`). Si cae antes de movimientos existentes, los saldos
 *   corridos posteriores se recalculan en la misma transacción.
 * - Idempotente: por `gatewayTransactionId` (recargas de DevDiem) o por
 *   `idempotencyKey` + huella de la solicitud (abonos manuales). Una
 *   transferencia manual se abona una sola vez por wallet (referencia única).
 * - Rechaza fechas futuras o dentro de un periodo ya cerrado por un estado de
 *   cuenta.
 */
export async function recharge(params: {
    companyId: string;
    amount: number;
    occurredAt: Date;
    occurredAtSource: RechargeTimeSource;
    method?: WalletRechargeMethod;
    externalReference?: string;
    /** DevDiem top-up id when the money was collected by DevDiem (unique). */
    gatewayTransactionId?: string;
    idempotencyKey?: string;
    requestFingerprint?: string;
    description?: string;
    actorId?: string;
}) {
    if (!(params.amount > 0) || !Number.isFinite(params.amount)) {
        throw badRequest("El monto del abono debe ser mayor a 0");
    }
    const method = params.method ?? "MANUAL";
    const externalReference = params.externalReference
        ? normalizeBankReference(params.externalReference)
        : undefined;
    if (method === "MANUAL" && !externalReference) {
        throw badRequest("La referencia de la transferencia es obligatoria");
    }
    if (Boolean(params.idempotencyKey) !== Boolean(params.requestFingerprint)) {
        throw new Error("idempotencyKey y requestFingerprint van juntos");
    }
    if (params.occurredAtSource === "GATEWAY_CONFIRMATION" && !params.gatewayTransactionId) {
        throw new Error("Una confirmación de pasarela requiere gatewayTransactionId");
    }

    try {
        return await runSerializableTransaction(prisma, async (tx) => {
            if (params.idempotencyKey) {
                const previous = await tx.walletTransaction.findUnique({
                    where: { idempotencyKey: params.idempotencyKey },
                });
                if (previous) {
                    if (previous.requestFingerprint !== params.requestFingerprint) {
                        throw conflict("La clave de idempotencia ya se usó con otros datos");
                    }
                    return { transaction: previous, replayed: true };
                }
            }
            const wallet = await getOrCreateWallet(params.companyId, tx);
            const problem = effectiveTimeProblem({ occurredAt: params.occurredAt, now: new Date() });
            if (problem) throw badRequest(problem);
            await assertOpenPeriod(tx, wallet.id, params.occurredAt);

            const created = await tx.walletTransaction.create({
                data: {
                    walletId: wallet.id,
                    type: "RECHARGE",
                    status: "CONFIRMED",
                    method,
                    amount: params.amount,
                    externalReference,
                    gatewayTransactionId: params.gatewayTransactionId,
                    idempotencyKey: params.idempotencyKey,
                    requestFingerprint: params.requestFingerprint,
                    description: params.description,
                    createdById: params.actorId,
                    occurredAt: params.occurredAt,
                    occurredAtSource: params.occurredAtSource,
                },
            });
            await rebuildWalletLedger(tx, wallet.id);
            const transaction = await tx.walletTransaction.findUniqueOrThrow({ where: { id: created.id } });
            return { transaction, replayed: false };
        });
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            const target = String((error.meta as { target?: unknown } | undefined)?.target ?? "");
            if (target.includes("gatewayTransactionId")) throw error;
            if (target.includes("idempotencyKey")) {
                throw conflict("La solicitud ya se está procesando con esta clave de idempotencia");
            }
            throw conflict("Esta transferencia ya fue abonada a la wallet", { externalReference });
        }
        throw error;
    }
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
export async function getWalletForCompany(
    companyId: string,
    opts?: { page?: number; pageSize?: number } & Partial<Omit<WalletMovementFilters, "page">>,
) {
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
        ...(opts?.type ? { type: opts.type } : {}),
        ...(opts?.from || opts?.to ? {
            AND: [{ occurredAt: { ...(opts.from ? { gte: opts.from } : {}), ...(opts.to ? { lt: opts.to } : {}) } }],
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
            effectiveTimeLabel: effectiveTimeLabel(transaction.occurredAtSource, transaction.createdAt),
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
