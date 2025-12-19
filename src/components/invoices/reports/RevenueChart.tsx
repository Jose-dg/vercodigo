"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";

interface RevenueChartProps {
    data: Array<{
        month: string;
        revenue: number;
    }>;
}

export function RevenueChart({ data }: RevenueChartProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Ingresos por Mes</CardTitle>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="revenue" fill="#3b82f6" />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}
