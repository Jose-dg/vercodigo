import prisma from "@/lib/prisma";
import { getOrCreateWallet } from "@/services/wallet/wallet.service";

/**
 * Resumen operativo de una compañía para OWNER/GENERAL_ADMIN: qué se pide en
 * TODOS sus locales (activaciones + compras de códigos), stats y actividad
 * reciente, más su situación de wallet.
 */
export async function getCompanyOverview(companyId: string) {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const stores = await prisma.store.findMany({
        where: { companyId },
        select: { id: true, name: true, isActive: true },
        orderBy: { name: "asc" },
    });
    const storeIds = stores.map((s) => s.id);

    const wallet = await getOrCreateWallet(companyId);

    const [
        activationsToday,
        activations30d,
        purchasesToday,
        purchases30d,
        consumption30d,
        activationsByStore,
        purchasesByStore,
        recentActivations,
        recentPurchases,
    ] = await Promise.all([
        prisma.cardActivation.count({ where: { storeId: { in: storeIds }, activatedAt: { gte: startOfToday } } }),
        prisma.cardActivation.count({ where: { storeId: { in: storeIds }, activatedAt: { gte: thirtyDaysAgo } } }),
        prisma.codePurchase.count({ where: { companyId, createdAt: { gte: startOfToday } } }),
        prisma.codePurchase.count({ where: { companyId, createdAt: { gte: thirtyDaysAgo } } }),
        prisma.walletTransaction.aggregate({
            where: {
                walletId: wallet.id,
                type: "CONSUMPTION",
                status: "CONFIRMED",
                createdAt: { gte: thirtyDaysAgo },
            },
            _sum: { amount: true },
        }),
        prisma.cardActivation.groupBy({
            by: ["storeId"],
            where: { storeId: { in: storeIds }, activatedAt: { gte: thirtyDaysAgo } },
            _count: { _all: true },
        }),
        prisma.codePurchase.groupBy({
            by: ["storeId"],
            where: { companyId, createdAt: { gte: thirtyDaysAgo } },
            _count: { _all: true },
        }),
        prisma.cardActivation.findMany({
            where: { storeId: { in: storeIds } },
            orderBy: { activatedAt: "desc" },
            take: 15,
            select: {
                id: true,
                activatedAt: true,
                activatedBy: true,
                activationAmount: true,
                store: { select: { name: true } },
                card: { select: { uuid: true, product: { select: { name: true } } } },
            },
        }),
        prisma.codePurchase.findMany({
            where: { companyId },
            orderBy: { createdAt: "desc" },
            take: 15,
            select: {
                id: true,
                createdAt: true,
                userId: true,
                productId: true,
                storeId: true,
                count: true,
                totalAmount: true,
                currency: true,
            },
        }),
    ]);

    // CodePurchase no tiene relaciones a User/Product en el schema: resolver
    // nombres en lote. activatedBy puede ser un userId (autoservicio) o un
    // teléfono (webhook WhatsApp) — resolver los que existan como usuarios.
    const userIds = [
        ...new Set([
            ...recentPurchases.map((p) => p.userId),
            ...recentActivations.map((a) => a.activatedBy),
        ]),
    ];
    const productIds = [...new Set(recentPurchases.map((p) => p.productId))];
    const [users, products] = await Promise.all([
        prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }),
        prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true } }),
    ]);
    const userName = (id: string) => users.find((u) => u.id === id)?.name ?? id;
    const productName = (id: string) => products.find((p) => p.id === id)?.name ?? "—";
    const storeName = (id: string | null) => stores.find((s) => s.id === id)?.name ?? "—";

    const recentActivity = [
        ...recentActivations.map((a) => ({
            id: a.id,
            type: "ACTIVATION" as const,
            date: a.activatedAt,
            productName: a.card.product.name,
            storeName: a.store.name,
            requestedBy: userName(a.activatedBy),
            detail: `Tarjeta ${a.card.uuid}`,
            amount: a.activationAmount,
        })),
        ...recentPurchases.map((p) => ({
            id: p.id,
            type: "CODE_PURCHASE" as const,
            date: p.createdAt,
            productName: productName(p.productId),
            storeName: storeName(p.storeId),
            requestedBy: userName(p.userId),
            detail: `${p.count} código(s)`,
            amount: p.totalAmount,
        })),
    ]
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .slice(0, 15);

    return {
        wallet: { balance: wallet.balance, currency: wallet.currency },
        stats: {
            activationsToday,
            activations30d,
            purchasesToday,
            purchases30d,
            consumption30d: consumption30d._sum.amount ?? 0,
            activeStores: stores.filter((s) => s.isActive).length,
        },
        byStore: stores.map((s) => ({
            storeId: s.id,
            storeName: s.name,
            isActive: s.isActive,
            activations30d: activationsByStore.find((a) => a.storeId === s.id)?._count._all ?? 0,
            purchases30d: purchasesByStore.find((p) => p.storeId === s.id)?._count._all ?? 0,
        })),
        recentActivity,
    };
}
