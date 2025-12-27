"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KPIData } from "@/lib/analytics/types";
import { ArrowDownIcon, ArrowUpIcon, CreditCard, DollarSign, Percent, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface KPICardsProps {
    data: KPIData;
    isLoading?: boolean;
}

export function KPICards({ data, isLoading }: KPICardsProps) {
    const kpis = [
        {
            title: "Activaciones Totales",
            value: data.totalActivations,
            change: data.periodComparison.activations.change,
            icon: CreditCard,
            format: (v: number) => v.toLocaleString(),
        },
        {
            title: "Ingresos Totales",
            value: data.totalRevenue,
            change: data.periodComparison.revenue.change,
            icon: DollarSign,
            format: (v: number) => `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        },
        {
            title: "Utilidad Bruta",
            value: data.totalGrossProfit,
            change: 0, // No comparison for profit yet
            icon: TrendingUp,
            format: (v: number) => `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        },
        {
            title: "Tasa de Activación",
            value: data.activationRate,
            change: 0, // No comparison for rate yet
            icon: Percent,
            format: (v: number) => `${v.toFixed(1)}%`,
        },
    ];

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {kpis.map((kpi, i) => (
                <Card key={i} className="bg-white shadow-sm border-gray-200">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">
                            {kpi.title}
                        </CardTitle>
                        <kpi.icon className="h-4 w-4 text-gray-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-gray-900">
                            {isLoading ? "..." : kpi.format(kpi.value)}
                        </div>
                        {kpi.change !== 0 && (
                            <p className={cn(
                                "text-xs mt-1 flex items-center gap-1",
                                kpi.change > 0 ? "text-green-600" : "text-red-600"
                            )}>
                                {kpi.change > 0 ? (
                                    <ArrowUpIcon className="h-3 w-3" />
                                ) : (
                                    <ArrowDownIcon className="h-3 w-3" />
                                )}
                                {Math.abs(kpi.change).toFixed(1)}% vs periodo anterior
                            </p>
                        )}
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
