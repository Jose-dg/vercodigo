export interface AnalyticsFilters {
    dateFrom?: string;
    dateTo?: string;
    storeId?: string;
    productId?: string;
    companyId?: string;
}

export interface KPIData {
    totalActivations: number;
    totalRevenue: number;
    totalGrossProfit: number;
    activationRate: number;
    periodComparison: {
        activations: { current: number; previous: number; change: number };
        revenue: { current: number; previous: number; change: number };
    };
}

export interface ProductMetric {
    productId: string;
    productName: string;
    brand: string;
    totalCards: number;
    activatedCards: number;
    activationRate: number;
    revenue: number;
}

export interface StoreMetric {
    storeId: string;
    storeName: string;
    activations: number;
    revenue: number;
    grossProfit: number;
}

export interface FinancialMetric {
    date: string;
    revenue: number;
    grossProfit: number;
    commissions: number;
}

export interface LifecycleMetric {
    stage: string;
    count: number;
    avgTimeHours?: number;
}

export interface InventoryMetric {
    category: string;
    total: number;
    available: number;
    activated: number;
}

export interface BillingMetric {
    status: string;
    count: number;
    amount: number;
}
