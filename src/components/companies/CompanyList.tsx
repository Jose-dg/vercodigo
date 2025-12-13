'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Building2, Eye, Edit, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

interface Company {
    id: string;
    name: string;
    taxId: string;
    email: string;
    phone: string;
    address: string | null;
    isActive: boolean;
    billingFrequency: string;
    commissionRate: number;
    createdAt: Date;
    _count: {
        stores: number;
        users: number;
        invoices: number;
    };
}

export function CompanyList({ companies }: { companies: Company[] }) {
    const { toast } = useToast();
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`¿Estás seguro de que deseas eliminar la compañía "${name}"?`)) {
            return;
        }

        setDeletingId(id);
        try {
            const res = await fetch(`/api/companies/${id}`, {
                method: 'DELETE',
            });

            if (!res.ok) {
                throw new Error('Error al eliminar');
            }

            toast({
                title: 'Compañía eliminada',
                description: `La compañía "${name}" ha sido eliminada exitosamente.`,
            });
            window.location.reload();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'No se pudo eliminar la compañía.',
            });
        } finally {
            setDeletingId(null);
        }
    };

    const getBillingFrequencyLabel = (frequency: string) => {
        const labels: Record<string, string> = {
            DAILY: 'Diario',
            THREE_DAYS: 'Cada 3 días',
            WEEKLY: 'Semanal',
            BIWEEKLY: 'Quincenal',
            MONTHLY: 'Mensual',
        };
        return labels[frequency] || frequency;
    };

    return (
        <Card className="bg-white shadow-sm border-gray-200">
            <CardHeader>
                <CardTitle>Listado de Compañías</CardTitle>
                <CardDescription>Total de compañías: {companies.length}</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Compañía</TableHead>
                                <TableHead>Tax ID</TableHead>
                                <TableHead>Contacto</TableHead>
                                <TableHead>Configuración</TableHead>
                                <TableHead>Estadísticas</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead>Creado</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {companies.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="h-24 text-center text-gray-500">
                                        No hay compañías registradas.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                companies.map((company) => (
                                    <TableRow key={company.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                                                    <Building2 className="w-5 h-5 text-gray-500" />
                                                </div>
                                                <div>
                                                    <div className="font-medium text-gray-900">{company.name}</div>
                                                    {company.address && (
                                                        <div className="text-sm text-gray-500">{company.address}</div>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="font-mono text-xs">
                                                {company.taxId}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-sm">
                                                <div className="text-gray-900">{company.email}</div>
                                                <div className="text-gray-500">{company.phone}</div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-sm">
                                                <div className="text-gray-600">
                                                    Facturación: {getBillingFrequencyLabel(company.billingFrequency)}
                                                </div>
                                                <div className="text-gray-500">
                                                    Comisión: {(company.commissionRate * 100).toFixed(1)}%
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-sm space-y-1">
                                                <div className="text-gray-600">
                                                    <span className="font-medium">{company._count.stores}</span> tiendas
                                                </div>
                                                <div className="text-gray-500">
                                                    <span className="font-medium">{company._count.users}</span> usuarios
                                                </div>
                                                <div className="text-gray-500">
                                                    <span className="font-medium">{company._count.invoices}</span> facturas
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {company.isActive ? (
                                                <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">
                                                    Activa
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-gray-500 border-gray-200">
                                                    Inactiva
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-gray-500 text-sm">
                                            {format(new Date(company.createdAt), 'PPP', { locale: es })}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end items-center gap-2">
                                                <Button variant="ghost" size="icon" asChild>
                                                    <Link href={`/companies/${company.id}`}>
                                                        <Eye className="h-4 w-4 text-gray-500" />
                                                        <span className="sr-only">Ver detalles</span>
                                                    </Link>
                                                </Button>
                                                <Button variant="ghost" size="icon" asChild>
                                                    <Link href={`/companies/${company.id}/edit`}>
                                                        <Edit className="h-4 w-4 text-gray-500" />
                                                        <span className="sr-only">Editar</span>
                                                    </Link>
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDelete(company.id, company.name)}
                                                    disabled={deletingId === company.id}
                                                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                    <span className="sr-only">Eliminar</span>
                                                </Button>
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

