'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CreditCard, Plus, RefreshCw, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAbility } from '@/components/auth/ability-context';
import { useTopUp } from '@/components/wallet/top-up-provider';
import { useWalletSummary } from '@/components/wallet/wallet-balance-chip';
import { DashboardKpis } from './dashboard-kpis';
import { DashboardRecentOrders } from './dashboard-recent-orders';
import { DashboardStatistics, type RangeSelection } from './dashboard-statistics';
import type { DashboardData } from './dashboard-format';

function query(selection: RangeSelection, companyId: string | null) {
    const params = new URLSearchParams({ range: selection.range });
    if (selection.range === 'period') {
        params.set('from', selection.from);
        params.set('to', selection.to);
    }
    if (companyId) params.set('companyId', companyId);
    return params.toString();
}

function HomeSkeleton() {
    return (
        <div role="status" className="space-y-6">
            <span className="sr-only">Cargando…</span>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-36 rounded-2xl" />)}
            </div>
            <Skeleton className="h-[34rem] rounded-2xl" />
            <Skeleton className="h-72 rounded-2xl" />
        </div>
    );
}

/** Company home: KPIs, statistics by range (with Excel) and recent orders. */
export function CompanyHome({ name, email, isPlatform }: { name: string; email: string; isPlatform: boolean }) {
    const ability = useAbility();
    const [companies, setCompanies] = useState<{ companyId: string; companyName: string }[]>([]);
    const [companyId, setCompanyId] = useState('');
    const [selection, setSelection] = useState<RangeSelection>({ range: '30d' });
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);
    const sequence = useRef(0);
    const { canTopUp, openTopUp } = useTopUp();
    const { data: walletSummary } = useWalletSummary();
    const topUpReady = !isPlatform && canTopUp && walletSummary?.topUpsAvailable === true;
    const scopeCompany = isPlatform ? companyId || null : null;

    useEffect(() => {
        if (!isPlatform) return;
        fetch('/api/wallets')
            .then((response) => response.json())
            .then((body: { wallets?: { companyId: string; companyName: string }[] }) =>
                setCompanies((body.wallets ?? []).map((row) => ({ companyId: row.companyId, companyName: row.companyName }))))
            .catch(() => undefined);
    }, [isPlatform]);

    const load = useCallback(async () => {
        if (isPlatform && !scopeCompany) return;
        // A slower, older response never replaces the one for the current selection.
        const id = ++sequence.current;
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/company/dashboard?${query(selection, scopeCompany)}`, { cache: 'no-store' });
            const body = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(body.message || 'No se pudo cargar el resumen');
            if (id === sequence.current) setData(body);
        } catch (failure) {
            if (id !== sequence.current) return;
            const message = failure instanceof Error ? failure.message : 'No se pudo cargar el resumen';
            setError(message);
            toast.error(message);
        } finally {
            if (id === sequence.current) setLoading(false);
        }
    }, [isPlatform, scopeCompany, selection]);

    useEffect(() => {
        void load();
    }, [load]);

    const exportExcel = async () => {
        setExporting(true);
        try {
            const response = await fetch(`/api/company/dashboard/export?${query(selection, scopeCompany)}`);
            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                throw new Error(body.message || 'No se pudo generar el Excel');
            }
            const disposition = response.headers.get('Content-Disposition') ?? '';
            const fileName = /filename="([^"]+)"/.exec(disposition)?.[1] ?? 'estadisticas.xlsx';
            const url = URL.createObjectURL(await response.blob());
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            link.click();
            URL.revokeObjectURL(url);
        } catch (failure) {
            toast.error(failure instanceof Error ? failure.message : 'No se pudo generar el Excel');
        } finally {
            setExporting(false);
        }
    };

    const canBuy = ability.can('create', 'CodePurchase');
    const canActivate = ability.can('activate', 'Card');

    return (
        <div className="mx-auto w-full min-w-0 max-w-[1440px] space-y-5 overflow-x-hidden p-4 sm:space-y-6 sm:p-6 lg:p-8">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                <div className="min-w-0">
                    <h1 className="text-pretty text-2xl font-semibold tracking-tight sm:text-3xl">Bienvenido, {name.split(' ')[0] || name}</h1>
                    <p className="mt-1 truncate text-sm text-muted-foreground">{email}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center lg:justify-end">
                    {isPlatform && (
                        <Select value={companyId} onValueChange={(value) => { setData(null); setCompanyId(value); }}>
                            <SelectTrigger className="col-span-2 h-11 w-full sm:w-64">
                                <SelectValue placeholder="Seleccionar compañía…" />
                            </SelectTrigger>
                            <SelectContent>
                                {companies.map((company) => (
                                    <SelectItem key={company.companyId} value={company.companyId}>{company.companyName}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                    {topUpReady && (
                        <Button className="h-11 min-w-0" variant="outline" onClick={() => openTopUp()}>
                            <Plus aria-hidden="true" className="mr-1.5 size-4" />
                            Recargar saldo
                        </Button>
                    )}
                    {canActivate && (
                        <Button asChild className="h-11 min-w-0" variant="outline">
                            <Link href="/activate"><CreditCard aria-hidden="true" className="mr-1.5 size-4" />Activar tarjeta</Link>
                        </Button>
                    )}
                    {canBuy && (
                        <Button asChild className="col-span-2 h-11 sm:col-span-1">
                            <Link href="/codes/purchase"><ShoppingCart aria-hidden="true" className="mr-1.5 size-4" />Comprar códigos</Link>
                        </Button>
                    )}
                </div>
            </div>

            {isPlatform && !companyId ? (
                <p className="py-16 text-center text-muted-foreground">Selecciona una compañía para ver su resumen.</p>
            ) : error && !data ? (
                <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
                    <p>{error}</p>
                    <Button variant="outline" size="sm" onClick={() => void load()}>
                        <RefreshCw className="mr-1.5 size-4" />
                        Reintentar
                    </Button>
                </div>
            ) : !data ? (
                <HomeSkeleton />
            ) : (
                <>
                    <DashboardKpis data={data} />
                    <DashboardStatistics
                        data={data}
                        selection={selection}
                        onSelectionChange={setSelection}
                        loading={loading}
                        onExport={() => void exportExcel()}
                        exporting={exporting}
                    />
                    <DashboardRecentOrders orders={data.recentOrders} />
                </>
            )}
        </div>
    );
}
