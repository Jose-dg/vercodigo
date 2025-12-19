import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "../shared/StatusBadge";
import { CurrencyDisplay } from "../shared/CurrencyDisplay";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Eye } from "lucide-react";
import Link from "next/link";
import type { Invoice, Company } from "@prisma/client";

interface InvoiceTableProps {
    invoices: (Invoice & { company: Company })[];
}

export function InvoiceTable({ invoices }: InvoiceTableProps) {
    if (invoices.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground">
                No se encontraron facturas
            </div>
        );
    }

    return (
        <div className="border rounded-lg">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Número</TableHead>
                        <TableHead>Empresa</TableHead>
                        <TableHead>Período</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {invoices.map((invoice) => (
                        <TableRow key={invoice.id}>
                            <TableCell className="font-medium">
                                {invoice.invoiceNumber}
                            </TableCell>
                            <TableCell>{invoice.company.name}</TableCell>
                            <TableCell>
                                {format(invoice.periodStart, "dd MMM", { locale: es })} -{" "}
                                {format(invoice.periodEnd, "dd MMM yyyy", { locale: es })}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                                <CurrencyDisplay amount={invoice.totalAmount} />
                            </TableCell>
                            <TableCell>
                                <StatusBadge status={invoice.status} />
                            </TableCell>
                            <TableCell className="text-right">
                                <Link href={`/invoices/${invoice.id}`}>
                                    <Button variant="ghost" size="sm">
                                        <Eye className="h-4 w-4 mr-2" />
                                        Ver
                                    </Button>
                                </Link>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
