import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { Invoice, Company } from "@prisma/client";

interface InvoiceInfoCardProps {
    invoice: Invoice & { company: Company };
}

export function InvoiceInfoCard({ invoice }: InvoiceInfoCardProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Información General</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <div className="text-muted-foreground">Empresa</div>
                        <div className="font-medium">{invoice.company.name}</div>
                    </div>
                    <div>
                        <div className="text-muted-foreground">NIT/RUC</div>
                        <div className="font-medium">{invoice.company.taxId}</div>
                    </div>
                    <div>
                        <div className="text-muted-foreground">Período</div>
                        <div className="font-medium">
                            {format(invoice.periodStart, "dd/MM/yyyy", { locale: es })} -{" "}
                            {format(invoice.periodEnd, "dd/MM/yyyy", { locale: es })}
                        </div>
                    </div>
                    <div>
                        <div className="text-muted-foreground">Fecha de Emisión</div>
                        <div className="font-medium">
                            {format(invoice.createdAt, "dd/MM/yyyy HH:mm", { locale: es })}
                        </div>
                    </div>
                    {invoice.paidAt && (
                        <div>
                            <div className="text-muted-foreground">Fecha de Pago</div>
                            <div className="font-medium">
                                {format(invoice.paidAt, "dd/MM/yyyy HH:mm", { locale: es })}
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
