"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StoreMetric } from "@/lib/analytics/types";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface StoresTabProps {
    data: StoreMetric[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

export function StoresTab({ data }: StoresTabProps) {
    const chartData = useMemo(() => {
        return data.map(item => ({
            name: item.storeName,
            activations: item.activations,
            revenue: item.revenue,
        }));
    }, [data]);

    return (
        <div className="grid gap-6">
            <Card className="bg-white shadow-sm border-gray-200">
                <CardHeader>
                    <CardTitle>Activaciones por Tienda</CardTitle>
                    <CardDescription>Comparativa del volumen de activaciones entre las diferentes tiendas.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                <YAxis tick={{ fontSize: 12 }} />
                                <Tooltip
                                    cursor={{ fill: '#f3f4f6' }}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="activations" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-white shadow-sm border-gray-200">
                <CardHeader>
                    <CardTitle>Detalle de Rendimiento por Tienda</CardTitle>
                    <CardDescription>Métricas detalladas de ventas y utilidad por punto de venta.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Tienda</TableHead>
                                <TableHead className="text-right">Activaciones</TableHead>
                                <TableHead className="text-right">Ingresos</TableHead>
                                <TableHead className="text-right">Utilidad Bruta</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.map((store) => (
                                <TableRow key={store.storeId}>
                                    <TableCell className="font-medium">{store.storeName}</TableCell>
                                    <TableCell className="text-right">{store.activations}</TableCell>
                                    <TableCell className="text-right">${store.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                                    <TableCell className="text-right">${store.grossProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                                </TableRow>
                            ))}
                            {data.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-4 text-gray-500">
                                        No hay datos disponibles para el periodo seleccionado.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
