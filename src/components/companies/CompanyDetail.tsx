"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Building2, Edit, Store, Users, FileText, Package, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface CompanyDetailProps {
    id: string;
}

export function CompanyDetail({ id }: CompanyDetailProps) {
    const [company, setCompany] = useState<any>(null);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchData() {
            try {
                const res = await fetch(`/api/companies/${id}`);
                if (!res.ok) {
                    throw new Error('Failed to fetch company data');
                }
                const data = await res.json();
                setCompany(data.company);
                setStats(data.stats);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'An unknown error occurred');
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [id]);

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

    if (loading) {
        return (
            <div className="space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <Skeleton className="h-9 w-64" />
                        <Skeleton className="h-5 w-80 mt-2" />
                    </div>
                    <Skeleton className="h-10 w-24" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[...Array(6)].map((_, i) => (
                        <Card key={i}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <Skeleton className="h-4 w-20" />
                                <Skeleton className="h-4 w-4" />
                            </CardHeader>
                            <CardContent>
                                <Skeleton className="h-8 w-16" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <Card>
                        <CardHeader>
                            <Skeleton className="h-6 w-40" />
                            <Skeleton className="h-4 w-48" />
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {[...Array(5)].map((_, i) => (
                                <div key={i}>
                                    <Skeleton className="h-4 w-24 mb-2" />
                                    <Skeleton className="h-6 w-full" />
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <Skeleton className="h-6 w-48" />
                            <Skeleton className="h-4 w-56" />
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {[...Array(4)].map((_, i) => (
                                <div key={i}>
                                    <Skeleton className="h-4 w-32 mb-2" />
                                    <Skeleton className="h-5 w-full" />
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    if (error) {
        return <div className="text-red-500 text-center p-8">{error}</div>;
    }

    if (!company) {
        return <div className="text-center p-8">No se encontró la compañía.</div>;
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">{company.name}</h1>
                    <p className="text-muted-foreground mt-2">Información detallada de la compañía</p>
                </div>
                <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
                    <Link href={`/companies/${company.id}/edit`}>
                        <Edit className="mr-2 h-4 w-4" />
                        Editar
                    </Link>
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-card shadow-sm border-border">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Tiendas</CardTitle>
                        <Store className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-foreground">{stats.totalStores}</div>
                    </CardContent>
                </Card>

                <Card className="bg-card shadow-sm border-border">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Usuarios</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-foreground">{stats.totalUsers}</div>
                    </CardContent>
                </Card>

                <Card className="bg-card shadow-sm border-border">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Facturas</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-foreground">{stats.totalInvoices}</div>
                    </CardContent>
                </Card>

                <Card className="bg-card shadow-sm border-border">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Tarjetas</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-foreground">{stats.totalCards}</div>
                    </CardContent>
                </Card>

                <Card className="bg-card shadow-sm border-border">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Activaciones</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-foreground">{stats.totalActivations}</div>
                    </CardContent>
                </Card>

                <Card className="bg-card shadow-sm border-border">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Ingresos Totales</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-foreground">
                            {formatCurrency(stats.totalRevenue, 'USD')}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card className="bg-card shadow-sm border-border">
                    <CardHeader>
                        <CardTitle>Información General</CardTitle>
                        <CardDescription>Datos básicos de la compañía</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="text-sm font-medium text-muted-foreground">Tax ID</label>
                            <p className="text-lg font-semibold text-foreground">
                                <Badge variant="outline" className="font-mono">
                                    {company.taxId}
                                </Badge>
                            </p>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-muted-foreground">Email</label>
                            <p className="text-lg font-semibold text-foreground">{company.email}</p>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-muted-foreground">Teléfono</label>
                            <p className="text-lg font-semibold text-foreground">{company.phone}</p>
                        </div>
                        {company.address && (
                            <div>
                                <label className="text-sm font-medium text-muted-foreground">Dirección</label>
                                <p className="text-lg font-semibold text-foreground">{company.address}</p>
                            </div>
                        )}
                        <div>
                            <label className="text-sm font-medium text-muted-foreground">Estado</label>
                            <p>
                                {company.isActive ? (
                                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">
                                        Activa
                                    </Badge>
                                ) : (
                                    <Badge variant="outline" className="text-muted-foreground border-border">
                                        Inactiva
                                    </Badge>
                                )}
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-card shadow-sm border-border">
                    <CardHeader>
                        <CardTitle>Configuración de Facturación</CardTitle>
                        <CardDescription>Parámetros de cobro y comisiones</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="text-sm font-medium text-muted-foreground">Frecuencia de Facturación</label>
                            <p className="text-lg font-semibold text-foreground">
                                {getBillingFrequencyLabel(company.billingFrequency)}
                            </p>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-muted-foreground">Tasa de Comisión</label>
                            <p className="text-lg font-semibold text-foreground">
                                {(company.commissionRate * 100).toFixed(1)}%
                            </p>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-muted-foreground">Fecha de Creación</label>
                            <p className="text-foreground">
                                {format(new Date(company.createdAt), "PPP 'a las' p", { locale: es })}
                            </p>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-muted-foreground">Última Actualización</label>
                            <p className="text-foreground">
                                {format(new Date(company.updatedAt), "PPP 'a las' p", { locale: es })}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {company.stores && company.stores.length > 0 && (
                <Card className="bg-card shadow-sm border-border">
                    <CardHeader>
                        <CardTitle>Tiendas ({company.stores.length})</CardTitle>
                        <CardDescription>Tiendas asociadas a esta compañía</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {company.stores.map((store: any) => (
                                <div
                                    key={store.id}
                                    className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/40"
                                >
                                    <div>
                                        <div className="font-medium text-foreground">{store.name}</div>
                                        <div className="text-sm text-muted-foreground">
                                            {store.address} • {store.code}
                                        </div>
                                    </div>
                                    <div className="text-right text-sm">
                                        <div className="text-muted-foreground">
                                            <span className="font-medium">{store._count.cards}</span> tarjetas
                                        </div>
                                        <div className="text-muted-foreground">
                                            <span className="font-medium">{store._count.activations}</span> activaciones
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

