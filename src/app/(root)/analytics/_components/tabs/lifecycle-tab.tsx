"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LifecycleMetric } from "@/lib/analytics/types";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, FunnelChart, Funnel, LabelList } from "recharts";

interface LifecycleTabProps {
    data: LifecycleMetric[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b'];

export function LifecycleTab({ data }: LifecycleTabProps) {
    const funnelData = useMemo(() => {
        return data.map((item, index) => ({
            value: item.count,
            name: item.stage,
            fill: COLORS[index % COLORS.length],
        }));
    }, [data]);

    return (
        <div className="grid gap-6 md:grid-cols-2">
            <Card className="bg-white shadow-sm border-gray-200">
                <CardHeader>
                    <CardTitle>Embudo de Ciclo de Vida</CardTitle>
                    <CardDescription>Visualización del flujo desde la generación hasta el canje.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <FunnelChart>
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Funnel
                                    data={funnelData}
                                    dataKey="value"
                                >
                                    <LabelList position="right" fill="#4b5563" stroke="none" dataKey="name" />
                                </Funnel>
                            </FunnelChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-white shadow-sm border-gray-200">
                <CardHeader>
                    <CardTitle>Métricas de Conversión</CardTitle>
                    <CardDescription>Porcentaje de tarjetas que avanzan a la siguiente etapa.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-8 mt-4">
                        {data.map((item, i) => {
                            const nextItem = data[i + 1];
                            const rate = nextItem ? (nextItem.count / item.count) * 100 : null;

                            return (
                                <div key={item.stage} className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium text-gray-500">{item.stage}</p>
                                        <p className="text-2xl font-bold text-gray-900">{item.count.toLocaleString()}</p>
                                    </div>
                                    {rate !== null && (
                                        <div className="text-right">
                                            <p className="text-xs text-gray-400 uppercase tracking-wider">Tasa de Conversión</p>
                                            <p className="text-lg font-semibold text-blue-600">{rate.toFixed(1)}%</p>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
