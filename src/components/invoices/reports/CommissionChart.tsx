"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Legend,
    Tooltip,
} from "recharts";

interface CommissionChartProps {
    data: Array<{
        company: string;
        commission: number;
    }>;
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

export function CommissionChart({ data }: CommissionChartProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Comisiones por Empresa</CardTitle>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                        <Pie
                            data={data}
                            dataKey="commission"
                            nameKey="company"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            label
                        >
                            {data.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={COLORS[index % COLORS.length]}
                                />
                            ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}
