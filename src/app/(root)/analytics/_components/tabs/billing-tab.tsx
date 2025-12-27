"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BillingMetric } from "@/lib/analytics/types";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface BillingTabProps {
    data: BillingMetric[];
}

const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444'];

const STATUS_MAP: Record<string, { label: string; variant: "outline" | "default" | "secondary" | "destructive" }> = {
    PENDING: { label: "Pendiente", variant: "outline" },
    INVOICED: { label: "Facturado", variant: "secondary" },
    PAID: { label: "Pagado", variant: "default" },
    CANCELLED: { label: "Cancelado", variant: "destructive" },
};

export function BillingTab({ data }: BillingTabProps) {
    const pieData = useMemo(() => {
        return data.map(item => ({
            name: STATUS_MAP[item.status]?.label || item.status,
            value: item.amount,
        }));
    }, [data]);

    return (
        <div className="grid gap-6 md:grid-cols-2">
            <Card className="bg-white shadow-sm border-gray-200">
                <CardHeader>
                    <CardTitle>Distribución de Facturación</CardTitle>
                    <CardDescription>Monto total por estado de facturación.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(value: any) => `$${Number(value).toLocaleString()}`}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-white shadow-sm border-gray-200">
                <CardHeader>
                    <CardTitle>Resumen de Estados</CardTitle>
                    <CardDescription>Conteo y montos acumulados por cada estado.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Estado</TableHead>
                                <TableHead className="text-right">Cantidad</TableHead>
                                <TableHead className="text-right">Monto Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.map((item) => (
                                <TableRow key={item.status}>
                                    <TableCell>
                                        <Badge variant={STATUS_MAP[item.status]?.variant || "outline"}>
                                            {STATUS_MAP[item.status]?.label || item.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">{item.count}</TableCell>
                                    <TableCell className="text-right">${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
