import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
    AnalyticsFilters,
    KPIData,
    ProductMetric,
    StoreMetric,
    FinancialMetric,
    LifecycleMetric,
    InventoryMetric,
    BillingMetric
} from "./types";
import { subDays, format } from "date-fns";

export async function getKPIMetrics(filters: AnalyticsFilters): Promise<KPIData> {
    const dateFrom = filters.dateFrom ? new Date(filters.dateFrom) : subDays(new Date(), 30);
    const dateTo = filters.dateTo ? new Date(filters.dateTo) : new Date();

    const previousDateFrom = subDays(dateFrom, 30);
    const previousDateTo = subDays(dateTo, 30);

    const whereClause: Prisma.CardActivationWhereInput = {
        activatedAt: {
            gte: dateFrom,
            lte: dateTo,
        },
        ...(filters.storeId && { storeId: filters.storeId }),
    };

    const previousWhereClause: Prisma.CardActivationWhereInput = {
        activatedAt: {
            gte: previousDateFrom,
            lte: previousDateTo,
        },
        ...(filters.storeId && { storeId: filters.storeId }),
    };

    const [currentStats, previousStats, totalCards] = await Promise.all([
        prisma.cardActivation.aggregate({
            where: whereClause,
            _count: { id: true },
            _sum: { activationAmount: true, grossProfit: true },
        }),
        prisma.cardActivation.aggregate({
            where: previousWhereClause,
            _count: { id: true },
            _sum: { activationAmount: true, grossProfit: true },
        }),
        prisma.card.count({
            where: {
                createdAt: { lte: dateTo },
                ...(filters.storeId && { storeId: filters.storeId }),
            },
        }),
    ]);

    const currentActivations = currentStats._count.id || 0;
    const previousActivations = previousStats._count.id || 0;
    const currentRevenue = currentStats._sum.activationAmount || 0;
    const previousRevenue = previousStats._sum.activationAmount || 0;

    const activationsChange = previousActivations === 0 ? 100 : ((currentActivations - previousActivations) / previousActivations) * 100;
    const revenueChange = previousRevenue === 0 ? 100 : ((currentRevenue - previousRevenue) / previousRevenue) * 100;

    return {
        totalActivations: currentActivations,
        totalRevenue: currentRevenue,
        totalGrossProfit: currentStats._sum.grossProfit || 0,
        activationRate: totalCards === 0 ? 0 : (currentActivations / totalCards) * 100,
        periodComparison: {
            activations: { current: currentActivations, previous: previousActivations, change: activationsChange },
            revenue: { current: currentRevenue, previous: previousRevenue, change: revenueChange },
        },
    };
}

export async function getProductMetrics(filters: AnalyticsFilters): Promise<ProductMetric[]> {
    const dateFrom = filters.dateFrom ? new Date(filters.dateFrom) : subDays(new Date(), 30);
    const dateTo = filters.dateTo ? new Date(filters.dateTo) : new Date();

    const whereClause: Prisma.CardWhereInput = {
        ...(filters.storeId && { storeId: filters.storeId }),
    };

    const topProducts = await prisma.card.groupBy({
        by: ['productId'],
        where: {
            ...whereClause,
            isActivated: true,
            activatedAt: {
                gte: dateFrom,
                lte: dateTo,
            },
        },
        _count: { id: true },
        _sum: { customAmount: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
    });

    const products = await prisma.product.findMany({
        where: { id: { in: topProducts.map((p: any) => p.productId) } },
        select: { id: true, name: true, brand: true },
    });

    const totalCardsByProduct = await prisma.card.groupBy({
        by: ['productId'],
        where: whereClause,
        _count: { id: true },
    });

    return topProducts.map((p: any) => {
        const product = products.find((pr: any) => pr.id === p.productId);
        const totalCards = totalCardsByProduct.find((tc: any) => tc.productId === p.productId)?._count.id || 0;
        const activatedCards = p._count.id || 0;

        return {
            productId: p.productId,
            productName: product?.name || 'Unknown',
            brand: product?.brand || 'Unknown',
            totalCards,
            activatedCards,
            activationRate: totalCards === 0 ? 0 : (activatedCards / totalCards) * 100,
            revenue: p._sum.customAmount || 0,
        };
    });
}

export async function getStoreMetrics(filters: AnalyticsFilters): Promise<StoreMetric[]> {
    const dateFrom = filters.dateFrom ? new Date(filters.dateFrom) : subDays(new Date(), 30);
    const dateTo = filters.dateTo ? new Date(filters.dateTo) : new Date();

    const storeStats = await prisma.cardActivation.groupBy({
        by: ['storeId'],
        where: {
            activatedAt: {
                gte: dateFrom,
                lte: dateTo,
            },
            ...(filters.storeId && { storeId: filters.storeId }),
        },
        _count: { id: true },
        _sum: { activationAmount: true, grossProfit: true },
        orderBy: { _sum: { activationAmount: 'desc' } },
    });

    const stores = await prisma.store.findMany({
        where: { id: { in: storeStats.map((s: any) => s.storeId) } },
        select: { id: true, name: true },
    });

    return storeStats.map((s: any) => {
        const store = stores.find((st: any) => st.id === s.storeId);
        return {
            storeId: s.storeId,
            storeName: store?.name || 'Unknown',
            activations: s._count.id || 0,
            revenue: s._sum.activationAmount || 0,
            grossProfit: s._sum.grossProfit || 0,
        };
    });
}

export async function getFinancialMetrics(filters: AnalyticsFilters): Promise<FinancialMetric[]> {
    const dateFrom = filters.dateFrom ? new Date(filters.dateFrom) : subDays(new Date(), 30);
    const dateTo = filters.dateTo ? new Date(filters.dateTo) : new Date();

    const activations = await prisma.cardActivation.findMany({
        where: {
            activatedAt: {
                gte: dateFrom,
                lte: dateTo,
            },
            ...(filters.storeId && { storeId: filters.storeId }),
        },
        select: {
            activatedAt: true,
            activationAmount: true,
            grossProfit: true,
            commissionAmount: true,
        },
        orderBy: { activatedAt: 'asc' },
    });

    // Group by day
    const grouped = activations.reduce((acc: Record<string, FinancialMetric>, curr: any) => {
        const date = format(curr.activatedAt, 'yyyy-MM-dd');
        if (!acc[date]) {
            acc[date] = { date, revenue: 0, grossProfit: 0, commissions: 0 };
        }
        acc[date].revenue += curr.activationAmount;
        acc[date].grossProfit += curr.grossProfit || 0;
        acc[date].commissions += curr.commissionAmount || 0;
        return acc;
    }, {} as Record<string, FinancialMetric>);

    return Object.values(grouped);
}

export async function getLifecycleMetrics(filters: AnalyticsFilters): Promise<LifecycleMetric[]> {
    const [total, activated, redeemed] = await Promise.all([
        prisma.card.count({ where: { ...(filters.storeId && { storeId: filters.storeId }) } }),
        prisma.card.count({ where: { isActivated: true, ...(filters.storeId && { storeId: filters.storeId }) } }),
        prisma.card.count({ where: { isRedeemed: true, ...(filters.storeId && { storeId: filters.storeId }) } }),
    ]);

    return [
        { stage: 'Generados', count: total },
        { stage: 'Activados', count: activated },
        { stage: 'Canjeados', count: redeemed },
    ];
}

export async function getInventoryMetrics(filters: AnalyticsFilters): Promise<InventoryMetric[]> {
    const inventory = await prisma.card.groupBy({
        by: ['productId'],
        where: { ...(filters.storeId && { storeId: filters.storeId }) },
        _count: { id: true },
    });

    const activated = await prisma.card.groupBy({
        by: ['productId'],
        where: { isActivated: true, ...(filters.storeId && { storeId: filters.storeId }) },
        _count: { id: true },
    });

    const products = await prisma.product.findMany({
        where: { id: { in: inventory.map((i: any) => i.productId) } },
        select: { id: true, name: true },
    });

    return inventory.map((i: any) => {
        const product = products.find((p: any) => p.id === i.productId);
        const actCount = activated.find((a: any) => a.productId === i.productId)?._count.id || 0;
        return {
            category: product?.name || 'Unknown',
            total: i._count.id,
            available: i._count.id - actCount,
            activated: actCount,
        };
    });
}

export async function getBillingMetrics(filters: AnalyticsFilters): Promise<BillingMetric[]> {
    const billing = await prisma.cardActivation.groupBy({
        by: ['billingStatus'],
        where: { ...(filters.storeId && { storeId: filters.storeId }) },
        _count: { id: true },
        _sum: { activationAmount: true },
    });

    return billing.map((b: any) => ({
        status: b.billingStatus,
        count: b._count.id,
        amount: b._sum.activationAmount || 0,
    }));
}

export async function getInitialMetrics(filters: AnalyticsFilters) {
    const [kpis, products, stores, financial, lifecycle, inventory, billing] = await Promise.all([
        getKPIMetrics(filters),
        getProductMetrics(filters),
        getStoreMetrics(filters),
        getFinancialMetrics(filters),
        getLifecycleMetrics(filters),
        getInventoryMetrics(filters),
        getBillingMetrics(filters),
    ]);

    return { kpis, products, stores, financial, lifecycle, inventory, billing };
}
