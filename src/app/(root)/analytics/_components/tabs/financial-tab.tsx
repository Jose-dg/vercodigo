"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FinancialMetric } from "@/lib/analytics/types";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

interface FinancialTabProps {
    data: FinancialMetric[];
}

export function FinancialTab({ data }: FinancialTabProps) {
    const chartData = useMemo(() => {
        return data.map(item => ({
            ...item,
            formattedDate: format(parseISO(item.date), "dd MMM", { locale: es }),
        }));
    }, [data]);

    return (
        <div className="grid gap-6">
            <Card className="bg-white shadow-sm border-gray-200">
                <CardHeader>
                    <CardTitle>Tendencia de Ingresos y Utilidad</CardTitle>
                    <CardDescription>Evolución diaria de las ventas y el margen bruto.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis
                                    dataKey="formattedDate"
                                    tick={{ fontSize: 12 }}
                                    minTickGap={30}
                                />
                                <YAxis tick={{ fontSize: 12 }} />
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Legend verticalAlign="top" height={36} />
                                <Area
                                    type="monotone"
                                    dataKey="revenue"
                                    name="Ingresos"
                                    stroke="#3b82f6"
                                    fillOpacity={1}
                                    fill="url(#colorRevenue)"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="grossProfit"
                                    name="Utilidad Bruta"
                                    stroke="#10b981"
                                    fillOpacity={1}
                                    fill="url(#colorProfit)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-white shadow-sm border-gray-200">
                <CardHeader>
                    <CardTitle>Comisiones Generadas</CardTitle>
                    <CardDescription>Seguimiento de las comisiones acumuladas por periodo.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="formattedDate" tick={{ fontSize: 12 }} minTickGap={30} />
                                <YAxis tick={{ fontSize: 12 }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="commissions"
                                    name="Comisiones"
                                    stroke="#f59e0b"
                                    strokeWidth={2}
                                    dot={{ r: 4 }}
                                    activeDot={{ r: 6 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
