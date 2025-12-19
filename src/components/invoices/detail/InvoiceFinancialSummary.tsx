import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CurrencyDisplay } from "../shared/CurrencyDisplay";

interface InvoiceFinancialSummaryProps {
    totalSales: number;
    commissionRate: number;
    commissionAmount: number;
    totalAmount: number;
}

export function InvoiceFinancialSummary({
    totalSales,
    commissionRate,
    commissionAmount,
    totalAmount,
}: InvoiceFinancialSummaryProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Resumen Financiero</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span className="font-medium">
                        <CurrencyDisplay amount={totalSales} />
                    </span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                        Comisión ({(commissionRate * 100).toFixed(0)}%):
                    </span>
                    <span className="text-red-600">
                        -<CurrencyDisplay amount={commissionAmount} />
                    </span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                    <span>Total Factura:</span>
                    <span className="text-primary">
                        <CurrencyDisplay amount={totalAmount} />
                    </span>
                </div>
            </CardContent>
        </Card>
    );
}
