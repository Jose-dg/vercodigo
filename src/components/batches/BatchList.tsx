'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Package, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';

interface Batch {
    id: string;
    code: string;
    description: string | null;
    manufacturer: string | null;
    currency: string;
    totalCards: number;
    totalCost: number;
    producedAt: Date;
    notes: string | null;
    createdAt: Date;
    _count: {
        cards: number;
    };
}

export function BatchList({ batches }: { batches: Batch[] }) {
    return (
        <Card className="bg-white shadow-sm border-gray-200">
            <CardHeader>
                <CardTitle>Listado de Lotes</CardTitle>
                <CardDescription>Total de lotes: {batches.length}</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Código</TableHead>
                                <TableHead>Descripción</TableHead>
                                <TableHead>Fabricante</TableHead>
                                <TableHead>Tarjetas</TableHead>
                                <TableHead>Costo Total</TableHead>
                                <TableHead>Costo Unitario</TableHead>
                                <TableHead>Producido</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {batches.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="h-24 text-center text-gray-500">
                                        No hay lotes registrados.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                batches.map((batch) => {
                                    const unitCost = batch.totalCards > 0 
                                        ? batch.totalCost / batch.totalCards 
                                        : 0;

                                    return (
                                        <TableRow key={batch.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                                                        <Package className="w-5 h-5 text-gray-500" />
                                                    </div>
                                                    <Badge variant="outline" className="font-mono text-xs">
                                                        {batch.code}
                                                    </Badge>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-gray-600">
                                                {batch.description || '-'}
                                            </TableCell>
                                            <TableCell className="text-gray-600">
                                                {batch.manufacturer || '-'}
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-sm">
                                                    <span className="font-medium text-gray-900">
                                                        {batch._count.cards}
                                                    </span>
                                                    <span className="text-gray-500"> / {batch.totalCards}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {formatCurrency(batch.totalCost, batch.currency)}
                                            </TableCell>
                                            <TableCell className="text-gray-600 text-sm">
                                                {formatCurrency(unitCost, batch.currency)}
                                            </TableCell>
                                            <TableCell className="text-gray-500 text-sm">
                                                {format(new Date(batch.producedAt), 'PPP', { locale: es })}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" asChild>
                                                    <Link href={`/batches/${batch.id}`}>
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

