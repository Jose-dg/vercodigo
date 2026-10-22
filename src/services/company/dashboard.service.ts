import prisma from "@/lib/prisma";
import { bogotaDay, fillSeries, type ResolvedRange } from "@/lib/dashboard/range";
import { publicDeliveryStatus } from "@/modules/api-v1/serializers";
import { getOrCreateWallet } from "@/services/wallet/wallet.service";

/**
 * Company home: money comes from the wallet ledger (what was really charged,
 * net of refunds, in the wallet currency); order counts from purchases and
 * activations. Days are Colombian days.
 */

type SpendRow = {
    day: string;
    service: "codes" | "activations" | "other";
    product_id: string | null;
    denomination_id: string | null;
    amount: number;
    orders: number;
};

const EPOCH = new Date(0);

async function spendRows(walletId: string, from: Date | null, to: Date): Promise<SpendRow[]> {
    // timestamp(3) columns hold UTC; parameters are pinned to UTC explicitly (a raw
    // Date would be cast with the session time zone).
    return prisma.$queryRaw<SpendRow[]>`
        WITH spend AS (
            SELECT to_char(t."occurredAt" - interval '5 hours', 'YYYY-MM-DD') AS day,
                   CASE WHEN t.type = 'CONSUMPTION' THEN t.amount ELSE -t.amount END AS amount,
                   COALESCE(t."codePurchaseId", r."codePurchaseId") AS purchase_id,
                   COALESCE(t."cardActivationId", r."cardActivationId") AS activation_id
            FROM "WalletTransaction" t
            LEFT JOIN "WalletTransaction" r ON r.id = t."reversalOfId"
            WHERE t."walletId" = ${walletId}
              AND t.status = 'CONFIRMED'
              AND t.type IN ('CONSUMPTION', 'REFUND')
              AND t."occurredAt" >= (${(from ?? EPOCH).toISOString()}::timestamptz AT TIME ZONE 'UTC')
              AND t."occurredAt" < (${to.toISOString()}::timestamptz AT TIME ZONE 'UTC')
        )
        SELECT s.day,
               CASE WHEN s.purchase_id IS NOT NULL THEN 'codes'
                    WHEN s.activation_id IS NOT NULL THEN 'activations'
                    ELSE 'other' END AS service,
               COALESCE(p."productId", c."productId") AS product_id,
               p."denominationId" AS denomination_id,
               SUM(s.amount)::float8 AS amount,
               COUNT(DISTINCT COALESCE(s.purchase_id, s.activation_id))::int AS orders
        FROM spend s
        LEFT JOIN "CodePurchase" p ON p.id = s.purchase_id
        LEFT JOIN "CardActivation" a ON a.id = s.activation_id
        LEFT JOIN "Card" c ON c.id = a."cardId"
        GROUP BY 1, 2, 3, 4`;
}

export const SERVICE_LABEL: Record<SpendRow["service"], string> = {
    codes: "Códigos digitales",
    activations: "Activaciones QR",
    other: "Otros cargos",
};

const round = (value: number) => Math.round(value * 100) / 100;

async function orderCounts(companyId: string, storeIds: string[], from: Date | null, to: Date) {
    const window = { ...(from ? { gte: from } : {}), lt: to };
    const [purchases, completed, activations] = await Promise.all([
        prisma.codePurchase.count({ where: { companyId, occurredAt: window } }),
        prisma.codePurchase.count({ where: { companyId, occurredAt: window, status: "COMPLETED" } }),
        prisma.cardActivation.count({ where: { storeId: { in: storeIds }, activatedAt: window } }),
    ]);
    // An activation exists only once it went through: it is always completed.
    return { orders: purchases + activations, completed: completed + activations };
}

function channelOf(snapshot: unknown): "api" | "portal" {
    const metadata = (snapshot as { body?: { metadata?: { channel?: unknown } } } | null)?.body?.metadata;
    return metadata?.channel === "api" ? "api" : "portal";
}

export type DashboardOrder = {
    id: string;
    kind: "purchase" | "activation";
    date: string;
    productName: string;
    brand: string | null;
    denomination: { amount: number; currency: string } | null;
    channel: "portal" | "api" | "qr";
    status: string;
    amount: number;
    currency: string;
    recipientEmail: string | null;
};

/** Purchases and activations in a window, newest first (recent list and Excel). */
export async function listDashboardOrders(params: {
    companyId: string;
    storeIds: string[];
    currency: string;
    from: Date | null;
    to: Date;
    take?: number;
}): Promise<DashboardOrder[]> {
    const window = { ...(params.from ? { gte: params.from } : {}), lt: params.to };
    const [purchases, activations] = await Promise.all([
        prisma.codePurchase.findMany({
            where: { companyId: params.companyId, occurredAt: window },
            orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
            take: params.take,
            select: {
                id: true, occurredAt: true, productId: true, status: true, totalAmount: true, currency: true,
                diemRequestSnapshot: true, denomination: { select: { amount: true, currency: true } },
            },
        }),
        prisma.cardActivation.findMany({
            where: { storeId: { in: params.storeIds }, activatedAt: window },
            orderBy: [{ activatedAt: "desc" }, { id: "desc" }],
            take: params.take,
            select: {
                id: true, activatedAt: true, activationAmount: true,
                card: { select: { product: { select: { name: true, brand: true } } } },
            },
        }),
    ]);
    const [products, activationCharges] = await Promise.all([
        prisma.product.findMany({
            where: { id: { in: [...new Set(purchases.map((row) => row.productId))] } },
            select: { id: true, name: true, brand: true },
        }),
        // What the wallet was charged for each activation (its own currency).
        prisma.walletTransaction.findMany({
            where: { cardActivationId: { in: activations.map((row) => row.id) }, type: "CONSUMPTION" },
            select: { cardActivationId: true, amount: true },
        }),
    ]);
    const chargeByActivation = new Map(activationCharges.map((row) => [row.cardActivationId, row.amount]));
    const productById = new Map(products.map((row) => [row.id, row]));
    const rows: DashboardOrder[] = [
        ...purchases.map((row) => {
            const body = (row.diemRequestSnapshot as { body?: { delivery_mode?: string; recipient?: { email?: string } } } | null)?.body;
            return {
                id: row.id,
                kind: "purchase" as const,
                date: row.occurredAt.toISOString(),
                productName: productById.get(row.productId)?.name ?? "Producto",
                brand: productById.get(row.productId)?.brand ?? null,
                denomination: row.denomination,
                channel: channelOf(row.diemRequestSnapshot),
                status: publicDeliveryStatus(row.status),
                amount: row.totalAmount,
                currency: row.currency,
                recipientEmail: body?.delivery_mode === "managed_and_partner" ? body.recipient?.email ?? null : null,
            };
        }),
        ...activations.map((row) => ({
            id: row.id,
            kind: "activation" as const,
            date: row.activatedAt.toISOString(),
            productName: row.card.product.name,
            brand: row.card.product.brand,
            denomination: null,
            channel: "qr" as const,
            status: "completed",
            amount: chargeByActivation.get(row.id) ?? row.activationAmount,
            currency: params.currency,
            recipientEmail: null,
        })),
    ].sort((left, right) => right.date.localeCompare(left.date));
    return params.take ? rows.slice(0, params.take) : rows;
}

export async function getCompanyDashboard(companyId: string, range: ResolvedRange) {
    const [wallet, stores] = await Promise.all([
        getOrCreateWallet(companyId),
        prisma.store.findMany({ where: { companyId }, select: { id: true } }),
    ]);
    const storeIds = stores.map((store) => store.id);

    const [deposits, consumptions, refunds, allTime, inRange, rows, recentOrders] = await Promise.all([
        prisma.walletTransaction.aggregate({ where: { walletId: wallet.id, type: "RECHARGE", status: "CONFIRMED" }, _sum: { amount: true } }),
        prisma.walletTransaction.aggregate({ where: { walletId: wallet.id, type: "CONSUMPTION", status: "CONFIRMED" }, _sum: { amount: true } }),
        prisma.walletTransaction.aggregate({ where: { walletId: wallet.id, type: "REFUND", status: "CONFIRMED" }, _sum: { amount: true } }),
        orderCounts(companyId, storeIds, null, range.to),
        orderCounts(companyId, storeIds, range.from, range.to),
        spendRows(wallet.id, range.from, range.to),
        listDashboardOrders({ companyId, storeIds, currency: wallet.currency, from: null, to: range.to, take: 10 }),
    ]);

    const firstDay = range.firstDay
        ?? rows.reduce<string | null>((min, row) => (min === null || row.day < min ? row.day : min), null)
        ?? range.lastDay;
    const { bucket, series } = fillSeries(rows.map((row) => ({ day: row.day, amount: row.amount })), firstDay, range.lastDay);

    const byService = new Map<SpendRow["service"], { amount: number; orders: number }>();
    const byProduct = new Map<string, { productId: string; denominationId: string | null; amount: number; orders: number }>();
    for (const row of rows) {
        const service = byService.get(row.service) ?? { amount: 0, orders: 0 };
        service.amount += row.amount;
        service.orders += row.orders;
        byService.set(row.service, service);
        if (!row.product_id) continue;
        const key = `${row.product_id}:${row.denomination_id ?? ""}`;
        const product = byProduct.get(key) ?? { productId: row.product_id, denominationId: row.denomination_id, amount: 0, orders: 0 };
        product.amount += row.amount;
        product.orders += row.orders;
        byProduct.set(key, product);
    }
    const top = [...byProduct.values()].filter((row) => row.amount > 0).sort((a, b) => b.amount - a.amount).slice(0, 10);
    const [topProducts, topDenominations] = await Promise.all([
        prisma.product.findMany({ where: { id: { in: top.map((row) => row.productId) } }, select: { id: true, name: true, brand: true } }),
        prisma.productDenomination.findMany({
            where: { id: { in: top.flatMap((row) => (row.denominationId ? [row.denominationId] : [])) } },
            select: { id: true, amount: true, currency: true, countryRegion: true },
        }),
    ]);

    return {
        currency: wallet.currency,
        kpis: {
            balance: wallet.balance,
            orders: allTime.orders,
            completedOrders: allTime.completed,
            totalSpent: round((consumptions._sum.amount ?? 0) - (refunds._sum.amount ?? 0)),
            deposited: round(deposits._sum.amount ?? 0),
        },
        stats: {
            range: range.range,
            firstDay,
            lastDay: range.lastDay,
            orders: inRange.orders,
            completedOrders: inRange.completed,
            spent: round(rows.reduce((sum, row) => sum + row.amount, 0)),
            bucket,
            series,
            byService: [...byService.entries()]
                .map(([service, value]) => ({ service, label: SERVICE_LABEL[service], amount: round(value.amount), orders: value.orders }))
                .filter((row) => row.amount !== 0)
                .sort((a, b) => b.amount - a.amount),
            topProducts: top.map((row) => {
                const product = topProducts.find((entry) => entry.id === row.productId);
                const denomination = topDenominations.find((entry) => entry.id === row.denominationId) ?? null;
                return {
                    productId: row.productId,
                    name: product?.name ?? "Producto",
                    brand: product?.brand ?? null,
                    denomination: denomination ? { amount: denomination.amount, currency: denomination.currency } : null,
                    region: denomination?.countryRegion ?? null,
                    amount: round(row.amount),
                    orders: row.orders,
                };
            }),
        },
        recentOrders,
        generatedAt: new Date().toISOString(),
        today: bogotaDay(new Date()),
    };
}

export type CompanyDashboard = Awaited<ReturnType<typeof getCompanyDashboard>>;
