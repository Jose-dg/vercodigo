'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { FileText, Eye, Download, PlusCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface Invoice {
    id: string;
    invoiceNumber: string;
    company: {
        name: string;
    };
    periodStart: Date;
    periodEnd: Date;
    totalSales: number;
    commissionAmount: number;
    totalAmount: number;
    status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
    paidAt: Date | null;
    createdAt: Date;
    pdfUrl?: string | null;
    _count: {
        items: number;
    };
}

export function InvoiceList({ invoices }: { invoices: Invoice[] }) {
    const router = useRouter();

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'PAID':
                return (
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">
                        Pagada
                    </Badge>
                );
            case 'PENDING':
                return (
                    <Badge variant="outline" className="text-yellow-600 border-yellow-200">
                        Pendiente
                    </Badge>
                );
            case 'OVERDUE':
                return (
                    <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border-red-200">
                        Vencida
                    </Badge>
                );
            case 'CANCELLED':
                return (
                    <Badge variant="outline" className="text-gray-500 border-gray-200">
                        Cancelada
                    </Badge>
                );
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    const handleRowClick = (id: string) => {
        router.push(`/invoices/${id}`);
    };

    return (
        <Card className="bg-white shadow-sm border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Listado de Facturas</CardTitle>
                    <CardDescription>Total de facturas: {invoices.length}</CardDescription>
                </div>
                <Button asChild>
                    <Link href="/invoices/create">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Crear Factura
                    </Link>
                </Button>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Número</TableHead>
                                <TableHead>Compañía</TableHead>
                                <TableHead>Periodo</TableHead>
                                <TableHead>Ventas</TableHead>
                                <TableHead>Comisión</TableHead>
                                <TableHead>Total</TableHead>
                                <TableHead>Items</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead>Creado</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {invoices.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={10} className="h-24 text-center text-gray-500">
                                        No hay facturas registradas.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                invoices.map((invoice) => (
                                    <TableRow
                                        key={invoice.id}
                                        onClick={() => handleRowClick(invoice.id)}
                                        className="cursor-pointer hover:bg-gray-50"
                                    >
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                                                    <FileText className="w-5 h-5 text-gray-500" />
                                                </div>
                                                <Badge variant="outline" className="font-mono text-xs">
                                                    {invoice.invoiceNumber}
                                                </Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            {invoice.company.name}
                                        </TableCell>
                                        <TableCell className="text-gray-600 text-sm">
                                            {format(new Date(invoice.periodStart), 'dd/MM/yyyy', { locale: es })} -{' '}
                                            {format(new Date(invoice.periodEnd), 'dd/MM/yyyy', { locale: es })}
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            {formatCurrency(invoice.totalSales, 'USD')}
                                        </TableCell>
                                        <TableCell className="text-gray-600">
                                            {formatCurrency(invoice.commissionAmount, 'USD')}
                                        </TableCell>
                                        <TableCell className="font-bold text-gray-900">
                                            {formatCurrency(invoice.totalAmount, 'USD')}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="text-gray-500 border-gray-200">
                                                {invoice._count.items} items
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                                        <TableCell className="text-gray-500 text-sm">
                                            {format(new Date(invoice.createdAt), 'PPP', { locale: es })}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end items-center gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        router.push(`/invoices/${invoice.id}`);
                                                    }}
                                                >
                                                    <Eye className="h-4 w-4 text-gray-500" />
                                                    <span className="sr-only">Ver detalles</span>
                                                </Button>
                                                {invoice.pdfUrl && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        asChild
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <a href={invoice.pdfUrl} target="_blank" rel="noopener noreferrer">
                                                            <Download className="h-4 w-4 text-gray-500" />
                                                            <span className="sr-only">Descargar PDF</span>
                                                        </a>
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
