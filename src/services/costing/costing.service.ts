import prisma from "@/lib/prisma";
import { Prisma, User, UserRole } from "@prisma/client";
import { badRequest, forbidden, notFound } from "@/lib/errors";
import { getOrCreateWallet } from "@/services/wallet/wallet.service";
import { computeCost, type ResolvedCost } from "@/lib/pricing/resolve-cost";
import { getUsdWholesaleRate } from "@/services/pricing/trm.service";

type Db = Prisma.TransactionClient | typeof prisma;

const PLATFORM_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.SYSTEM_ADMIN];

export type { ResolvedCost } from "@/lib/pricing/resolve-cost";

/**
 * Costo efectivo que se le cobra a una compañía por un producto/denominación —
 * lo que se debita de la wallet. La regla vive en computeCost (compartida con
 * la cotización del checkout). null si no hay forma de determinarlo (producto
 * sin denominaciones ni costo configurado) — el llamador registra el consumo PENDING.
 */
export async function resolveCost(
    companyId: string,
    productId: string,
    denominationId?: string | null,
    tx: Db = prisma
): Promise<ResolvedCost | null> {
    const [usdRate, wallet, denomination, usdCopConfig, costs] = await Promise.all([
        // Dentro de una transacción solo se lee la TRM guardada (la cotización previa ya
        // la trajo): una llamada HTTP dejaría la transacción abierta.
        getUsdWholesaleRate({ db: tx, fetchIfMissing: tx === prisma }),
        tx.wallet.findUnique({ where: { companyId }, select: { currency: true } }),
        denominationId
            ? tx.productDenomination.findUnique({ where: { id: denominationId } })
            : Promise.resolve(null),
        tx.systemConfig.findUnique({ where: { key: "FX_USD_COP" } }),
        tx.productCost.findMany({
            where: {
                productId,
                denominationId: denominationId ?? null,
                isActive: true,
                OR: [{ companyId }, { companyId: null }],
            },
        }),
    ]);
    return computeCost({
        companyId,
        walletCurrency: wallet?.currency ?? null,
        usdWholesaleRateCopPerUsd: usdRate?.rateCopPerUsd ?? null,
        fallbackRateCopPerUsd: usdCopConfig ? Number(usdCopConfig.value) : null,
        denomination,
        costs,
    });
}

export interface PurchaseQuote {
    productId: string;
    denominationId: string | null;
    nominalAmount: number | null;
    salePrice: number;
    currency: string;
    /** Tasa con la que se cobrará; el checkout la reenvía para detectar cambios. */
    rateCopPerUsd: number | null;
    effectiveRateCopPerUsd: number | null;
}

/**
 * Cotización del checkout para todos los productos activos, en cualquier moneda.
 * Usa computeCost, la misma regla que resolveCost aplica al cobrar.
 */
export async function getPurchaseQuotes(companyId: string): Promise<PurchaseQuote[]> {
    const [products, usdRate, wallet, usdCopConfig, costs] = await Promise.all([
        prisma.product.findMany({
            where: { isActive: true },
            select: { id: true, denominations: { select: { id: true, amount: true, currency: true, countryRegion: true } } },
        }),
        // La cotización corre fuera de transacción: aquí se trae la TRM del día si falta.
        getUsdWholesaleRate(),
        prisma.wallet.findUnique({ where: { companyId }, select: { currency: true } }),
        prisma.systemConfig.findUnique({ where: { key: "FX_USD_COP" } }),
        prisma.productCost.findMany({
            where: { isActive: true, OR: [{ companyId }, { companyId: null }] },
            select: { companyId: true, productId: true, denominationId: true, cost: true, currency: true },
        }),
    ]);
    const fallbackRateCopPerUsd = usdCopConfig ? Number(usdCopConfig.value) : null;
    const quote = (
        productId: string,
        denomination: { id: string; amount: number; currency: string; countryRegion: string | null } | null,
    ): PurchaseQuote[] => {
        const cost = computeCost({
            companyId,
            walletCurrency: wallet?.currency ?? null,
            usdWholesaleRateCopPerUsd: usdRate?.rateCopPerUsd ?? null,
            fallbackRateCopPerUsd,
            denomination,
            costs: costs.filter((row) => (
                row.productId === productId && row.denominationId === (denomination?.id ?? null)
            )),
        });
        if (!cost || !(cost.amount > 0)) return [];
        return [{
            productId,
            denominationId: denomination?.id ?? null,
            nominalAmount: denomination?.amount ?? null,
            salePrice: cost.amount,
            currency: cost.currency,
            rateCopPerUsd: cost.exchangeRate ?? null,
            effectiveRateCopPerUsd: cost.exchangeRate ?? null,
        }];
    };
    return products.flatMap((product) => (
        product.denominations.length === 0
            ? quote(product.id, null)
            : product.denominations.flatMap((denomination) => quote(product.id, denomination))
    ));
}

/**
 * Catálogo para la UI de plataforma: producto × denominación con el costo
 * global y, si se pide una compañía, su override y el costo efectivo.
 */
export async function getCostCatalog(companyId?: string | null) {
    const [products, costs, wallet] = await Promise.all([
        prisma.product.findMany({
            where: { isActive: true },
            orderBy: { name: "asc" },
            select: {
                id: true,
                name: true,
                brand: true,
                denominations: {
                    orderBy: { amount: "asc" },
                    select: { id: true, amount: true, currency: true },
                },
            },
        }),
        prisma.productCost.findMany({
            where: { isActive: true, OR: [{ companyId: null }, ...(companyId ? [{ companyId }] : [])] },
        }),
        companyId ? getOrCreateWallet(companyId) : Promise.resolve(null),
    ]);

    const findCost = (productId: string, denominationId: string | null, forCompany: string | null) =>
        costs.find(
            (c) => c.productId === productId && c.denominationId === denominationId && c.companyId === forCompany
        ) ?? null;

    const rows = products.flatMap((product) => {
        const denoms: ({ id: string | null; amount: number | null; currency: string | null })[] =
            product.denominations.length > 0
                ? product.denominations
                : [{ id: null, amount: null, currency: null }];

        return denoms.map((d) => {
            const globalCost = findCost(product.id, d.id, null);
            const companyCost = companyId ? findCost(product.id, d.id, companyId) : null;
            return {
                productId: product.id,
                productName: product.name,
                brand: product.brand,
                denominationId: d.id,
                nominalAmount: d.amount,
                nominalCurrency: d.currency,
                globalCostId: globalCost?.id ?? null,
                globalCost: globalCost?.cost ?? null,
                globalCurrency: globalCost?.currency ?? null,
                companyCostId: companyCost?.id ?? null,
                companyCost: companyCost?.cost ?? null,
                companyCurrency: companyCost?.currency ?? null,
            };
        });
    });

    return { companyId: companyId ?? null, walletCurrency: wallet?.currency ?? null, rows };
}

/**
 * Crea/actualiza un costo. Solo plataforma. Para overrides por compañía la
 * moneda se fuerza a la de la wallet de esa compañía (el costo negociado vive
 * en su moneda, sin FX al debitar).
 */
export async function upsertCost(
    params: {
        companyId?: string | null;
        productId: string;
        denominationId?: string | null;
        cost: number;
        currency?: string;
    },
    actor: Pick<User, "role">
) {
    if (!PLATFORM_ROLES.includes(actor.role)) throw forbidden("Solo la plataforma puede configurar costos");
    if (!(params.cost > 0)) throw badRequest("El costo debe ser mayor a 0");

    const companyId = params.companyId ?? null;
    let currency = (params.currency ?? "COP").trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) throw badRequest("Moneda inválida (código ISO de 3 letras)");

    const product = await prisma.product.findUnique({
        where: { id: params.productId },
        select: { id: true, denominations: { select: { id: true } } },
    });
    if (!product) throw notFound("Producto no encontrado");

    const denominationId = params.denominationId ?? null;
    if (denominationId && !product.denominations.some((d) => d.id === denominationId)) {
        throw badRequest("La denominación no pertenece al producto");
    }

    if (companyId) {
        const wallet = await getOrCreateWallet(companyId);
        currency = wallet.currency; // tarifa negociada siempre en la moneda de su wallet
    }

    // Upsert manual: el unique con companyId/denominationId nullable no
    // deduplica NULLs en Postgres.
    const existing = await prisma.productCost.findFirst({
        where: { companyId, productId: params.productId, denominationId },
    });

    if (existing) {
        return prisma.productCost.update({
            where: { id: existing.id },
            data: { cost: params.cost, currency, isActive: true },
        });
    }

    return prisma.productCost.create({
        data: { companyId, productId: params.productId, denominationId, cost: params.cost, currency },
    });
}

export async function deleteCost(costId: string, actor: Pick<User, "role">) {
    if (!PLATFORM_ROLES.includes(actor.role)) throw forbidden("Solo la plataforma puede configurar costos");
    const cost = await prisma.productCost.findUnique({ where: { id: costId } });
    if (!cost) throw notFound("Costo no encontrado");
    await prisma.productCost.delete({ where: { id: costId } });
    return { success: true };
}
