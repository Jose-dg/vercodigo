'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Zap, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';

interface Activation {
    id: string;
    card: {
        id: string;
        uuid: string;
        product: {
            name: string;
        };
        denomination: {
            amount: number;
            currency: string;
        } | null;
    };
    store: {
        name: string;
        company: {
            name: string;
        };
    };
    activatedBy: string;
    activatedAt: Date;
    activationAmount: number;
    commissionAmount: number | null;
    billingStatus: string;
    invoice: {
        invoiceNumber: string;
    } | null;
}

export function ActivationList({ activations }: { activations: Activation[] }) {
    const getBillingStatusLabel = (status: string) => {
        const labels: Record<string, { text: string; variant: 'default' | 'outline' }> = {
            PENDING: { text: 'Pendiente', variant: 'outline' },
            INVOICED: { text: 'Facturada', variant: 'default' },
            PAID: { text: 'Pagada', variant: 'default' },
            CANCELLED: { text: 'Cancelada', variant: 'outline' },
        };
        return labels[status] || { text: status, variant: 'outline' };
    };

    return (
        <Card className="bg-white shadow-sm border-gray-200">
            <CardHeader>
                <CardTitle>Listado de Activaciones</CardTitle>
                <CardDescription>Total de activaciones: {activations.length}</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Tarjeta</TableHead>
                                <TableHead>Producto</TableHead>
                                <TableHead>Tienda</TableHead>
                                <TableHead>Activado por</TableHead>
                                <TableHead>Monto</TableHead>
                                <TableHead>Comisión</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead>Fecha</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {activations.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="h-24 text-center text-gray-500">
                                        No hay activaciones registradas.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                activations.map((activation) => {
                                    const status = getBillingStatusLabel(activation.billingStatus);
                                    return (
                                        <TableRow key={activation.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                                                        <Zap className="w-5 h-5 text-gray-500" />
                                                    </div>
                                                    <Badge variant="outline" className="font-mono text-xs">
                                                        {activation.card.uuid}
                                                    </Badge>
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {activation.card.product.name}
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-sm">
                                                    <div className="text-gray-900">{activation.store.name}</div>
                                                    <div className="text-gray-500">{activation.store.company.name}</div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-gray-600">
                                                {activation.activatedBy}
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {formatCurrency(
                                                    activation.activationAmount,
                                                    activation.card.denomination?.currency || 'USD'
                                                )}
                                            </TableCell>
                                            <TableCell className="text-gray-600">
                                                {activation.commissionAmount
                                                    ? formatCurrency(activation.commissionAmount, 'USD')
                                                    : '-'}
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={status.variant}
                                                    className={
                                                        activation.billingStatus === 'PAID'
                                                            ? 'bg-green-100 text-green-800 hover:bg-green-100 border-green-200'
                                                            : activation.billingStatus === 'INVOICED'
                                                              ? 'bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200'
                                                              : ''
                                                    }
                                                >
                                                    {status.text}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-gray-500 text-sm">
                                                {format(new Date(activation.activatedAt), 'PPP p', { locale: es })}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" asChild>
                                                    <Link href={`/activations/${activation.id}`}>
                                                        <Eye className="h-4 w-4 text-gray-500" />
                                                        <span className="sr-only">Ver detalles</span>
                                                    </Link>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}

