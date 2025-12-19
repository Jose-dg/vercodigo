import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
} from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { CurrencyDisplay } from "../shared/CurrencyDisplay";
import type { InvoiceItem, Store } from "@prisma/client";

interface InvoiceItemsDetailProps {
    items: (InvoiceItem & { store: Store | null })[];
}

export function InvoiceItemsDetail({ items }: InvoiceItemsDetailProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Items de Factura ({items.length})</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Descripción</TableHead>
                            <TableHead className="text-right">Cantidad</TableHead>
                            <TableHead className="text-right">Precio Unit.</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.map((item) => (
                            <TableRow key={item.id}>
                                <TableCell>{item.description}</TableCell>
                                <TableCell className="text-right">{item.quantity}</TableCell>
                                <TableCell className="text-right">
                                    <CurrencyDisplay amount={item.unitPrice} />
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                    <CurrencyDisplay amount={item.totalPrice} />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
