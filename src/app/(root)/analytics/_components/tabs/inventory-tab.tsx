"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { InventoryMetric } from "@/lib/analytics/types";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface InventoryTabProps {
    data: InventoryMetric[];
}

export function InventoryTab({ data }: InventoryTabProps) {
    const chartData = useMemo(() => {
        return data.map(item => ({
            name: item.category,
            disponibles: item.available,
            activadas: item.activated,
        }));
    }, [data]);

    return (
        <div className="grid gap-6">
            <Card className="bg-white shadow-sm border-gray-200">
                <CardHeader>
                    <CardTitle>Estado del Inventario por Producto</CardTitle>
                    <CardDescription>Comparativa entre tarjetas disponibles y activadas por cada categoría.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                <YAxis tick={{ fontSize: 12 }} />
                                <Tooltip
                                    cursor={{ fill: '#f3f4f6' }}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Legend verticalAlign="top" height={36} />
                                <Bar dataKey="disponibles" name="Disponibles" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                                <Bar dataKey="activadas" name="Activadas" stackId="a" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
