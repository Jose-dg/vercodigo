import { Suspense } from "react";
import { AnalyticsDashboard } from "./_components/analytics-dashboard";
import { getInitialMetrics } from "@/lib/analytics/queries";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage({
    searchParams,
}: {
    searchParams: { dateFrom?: string; dateTo?: string; storeId?: string };
}) {
    // Fetch initial data on the server
    const [initialData, stores] = await Promise.all([
        getInitialMetrics(searchParams),
        prisma.store.findMany({
            where: { isActive: true },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
        }),
    ]);

    return (
        <div className="container mx-auto py-8 px-4">
            <AnalyticsDashboard initialData={initialData} stores={stores} />
        </div>
    );
}
