import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyDisplay } from "../shared/CurrencyDisplay";
import {
    DollarSign,
    AlertCircle,
    Clock,
    TrendingUp,
} from "lucide-react";

interface InvoiceStatsCardsProps {
    stats: {
        totalPending: number;
        totalOverdue: number;
        activationsPending: number;
        commissionsMonth: number;
    };
}

export function InvoiceStatsCards({ stats }: InvoiceStatsCardsProps) {
    const cards = [
        {
            title: "Total por Cobrar",
            value: stats.totalPending,
            icon: DollarSign,
            iconColor: "text-blue-600",
            bgColor: "bg-blue-100",
        },
        {
            title: "Facturas Vencidas",
            value: stats.totalOverdue,
            icon: AlertCircle,
            iconColor: "text-red-600",
            bgColor: "bg-red-100",
        },
        {
            title: "Activaciones Sin Facturar",
            value: stats.activationsPending,
            icon: Clock,
            iconColor: "text-yellow-600",
            bgColor: "bg-yellow-100",
        },
        {
            title: "Comisiones del Mes",
            value: stats.commissionsMonth,
            icon: TrendingUp,
            iconColor: "text-green-600",
            bgColor: "bg-green-100",
        },
    ];

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {cards.map((card) => (
                <Card key={card.title}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            {card.title}
                        </CardTitle>
                        <div className={`rounded-full p-2 ${card.bgColor}`}>
                            <card.icon className={`h-4 w-4 ${card.iconColor}`} />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            <CurrencyDisplay amount={card.value} />
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
