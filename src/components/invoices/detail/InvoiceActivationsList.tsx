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
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type {
    CardActivation,
    Store,
    Card as CardModel,
    Product,
} from "@prisma/client";

interface InvoiceActivationsListProps {
    activations: (CardActivation & {
        store: Store;
        card: CardModel & { product: Product };
    })[];
}

export function InvoiceActivationsList({
    activations,
}: InvoiceActivationsListProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    Activaciones Asociadas ({activations.length} QRs)
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="max-h-96 overflow-y-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>UUID</TableHead>
                                <TableHead>Producto</TableHead>
                                <TableHead>Tienda</TableHead>
                                <TableHead>Fecha Activación</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {activations.map((activation) => (
                                <TableRow key={activation.id}>
                                    <TableCell className="font-mono text-xs">
                                        {activation.card.uuid || activation.cardId.slice(0, 8)}
                                    </TableCell>
                                    <TableCell>{activation.card.product.name}</TableCell>
                                    <TableCell>{activation.store.name}</TableCell>
                                    <TableCell>
                                        {format(activation.activatedAt, "dd/MM/yyyy HH:mm", {
                                            locale: es,
                                        })}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
