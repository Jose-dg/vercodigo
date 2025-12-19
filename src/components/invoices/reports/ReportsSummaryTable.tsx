import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { CurrencyDisplay } from "../shared/CurrencyDisplay";

interface ReportsSummaryTableProps {
    data: Array<{
        company: string;
        totalInvoiced: number;
        totalPaid: number;
        pending: number;
    }>;
}

export function ReportsSummaryTable({ data }: ReportsSummaryTableProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Resumen por Empresa</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Empresa</TableHead>
                            <TableHead className="text-right">Total Facturado</TableHead>
                            <TableHead className="text-right">Pagado</TableHead>
                            <TableHead className="text-right">Pendiente</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.map((row) => (
                            <TableRow key={row.company}>
                                <TableCell className="font-medium">{row.company}</TableCell>
                                <TableCell className="text-right">
                                    <CurrencyDisplay amount={row.totalInvoiced} />
                                </TableCell>
                                <TableCell className="text-right text-green-600">
                                    <CurrencyDisplay amount={row.totalPaid} />
                                </TableCell>
                                <TableCell className="text-right text-yellow-600">
                                    <CurrencyDisplay amount={row.pending} />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
