"use client";

import { useState, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FiltersBar } from "./filters-bar";
import { KPICards } from "./kpi-cards";
import { ProductsTab } from "./tabs/products-tab";
import { StoresTab } from "./tabs/stores-tab";
import { FinancialTab } from "./tabs/financial-tab";
import { LifecycleTab } from "./tabs/lifecycle-tab";
import { InventoryTab } from "./tabs/inventory-tab";
import { BillingTab } from "./tabs/billing-tab";
import { useAnalytics } from "@/hooks/use-analytics";
import { Skeleton } from "@/components/ui/skeleton";

interface AnalyticsDashboardProps {
    initialData: any;
    stores: { id: string; name: string }[];
}

export function AnalyticsDashboard({ initialData, stores }: AnalyticsDashboardProps) {
    const [filters, setFilters] = useState<{ dateFrom?: Date; dateTo?: Date; storeId?: string }>({});

    const handleFiltersChange = useCallback((newFilters: any) => {
        setFilters(newFilters);
    }, []);

    const params = {
        dateFrom: filters.dateFrom?.toISOString(),
        dateTo: filters.dateTo?.toISOString(),
        storeId: filters.storeId,
    };

    const { data: productsData, isLoading: isLoadingProducts } = useAnalytics<any>("/api/analytics/products", params, { fallbackData: initialData.products });
    const { data: storesData, isLoading: isLoadingStores } = useAnalytics<any>("/api/analytics/stores", params, { fallbackData: initialData.stores });
    const { data: financialData, isLoading: isLoadingFinancial } = useAnalytics<any>("/api/analytics/financial", params, { fallbackData: initialData.financial });
    const { data: lifecycleData, isLoading: isLoadingLifecycle } = useAnalytics<any>("/api/analytics/lifecycle", params, { fallbackData: initialData.lifecycle });
    const { data: inventoryData, isLoading: isLoadingInventory } = useAnalytics<any>("/api/analytics/inventory", params, { fallbackData: initialData.inventory });
    const { data: billingData, isLoading: isLoadingBilling } = useAnalytics<any>("/api/analytics/billing", params, { fallbackData: initialData.billing });

    // For KPIs, we can use a separate endpoint or derive from initialData + updates
    // For simplicity, let's assume we have a /api/analytics/kpis or use initialData for now
    // Actually, let's just use initialData.kpis for now as a placeholder or implement the route
    const kpis = initialData.kpis; // In a real app, this would also be an SWR hook

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight text-gray-900">Analytics & Insights</h1>
                <p className="text-gray-500">Monitorea el rendimiento y las métricas clave de tu negocio.</p>
            </div>

            <FiltersBar onFiltersChange={handleFiltersChange} stores={stores} />

            <KPICards data={kpis} isLoading={false} />

            <Tabs defaultValue="products" className="space-y-6">
                <div className="border-b">
                    <TabsList className="bg-transparent h-auto p-0 gap-6">
                        <TabsTrigger value="products" className="data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 border-b-2 border-transparent rounded-none px-0 pb-2 bg-transparent shadow-none">Productos</TabsTrigger>
                        <TabsTrigger value="stores" className="data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 border-b-2 border-transparent rounded-none px-0 pb-2 bg-transparent shadow-none">Tiendas</TabsTrigger>
                        <TabsTrigger value="financial" className="data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 border-b-2 border-transparent rounded-none px-0 pb-2 bg-transparent shadow-none">Financiero</TabsTrigger>
                        <TabsTrigger value="lifecycle" className="data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 border-b-2 border-transparent rounded-none px-0 pb-2 bg-transparent shadow-none">Ciclo de Vida</TabsTrigger>
                        <TabsTrigger value="inventory" className="data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 border-b-2 border-transparent rounded-none px-0 pb-2 bg-transparent shadow-none">Inventario</TabsTrigger>
                        <TabsTrigger value="billing" className="data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 border-b-2 border-transparent rounded-none px-0 pb-2 bg-transparent shadow-none">Facturación</TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="products" className="mt-0">
                    {isLoadingProducts ? <TabSkeleton /> : <ProductsTab data={productsData} />}
                </TabsContent>
                <TabsContent value="stores" className="mt-0">
                    {isLoadingStores ? <TabSkeleton /> : <StoresTab data={storesData} />}
                </TabsContent>
                <TabsContent value="financial" className="mt-0">
                    {isLoadingFinancial ? <TabSkeleton /> : <FinancialTab data={financialData} />}
                </TabsContent>
                <TabsContent value="lifecycle" className="mt-0">
                    {isLoadingLifecycle ? <TabSkeleton /> : <LifecycleTab data={lifecycleData} />}
                </TabsContent>
                <TabsContent value="inventory" className="mt-0">
                    {isLoadingInventory ? <TabSkeleton /> : <InventoryTab data={inventoryData} />}
                </TabsContent>
                <TabsContent value="billing" className="mt-0">
                    {isLoadingBilling ? <TabSkeleton /> : <BillingTab data={billingData} />}
                </TabsContent>
            </Tabs>
        </div>
    );
}

function TabSkeleton() {
    return (
        <div className="grid gap-6 md:grid-cols-2">
            <Skeleton className="h-[400px] w-full rounded-lg" />
            <Skeleton className="h-[400px] w-full rounded-lg" />
            <Skeleton className="h-[300px] md:col-span-2 w-full rounded-lg" />
        </div>
    );
}
