"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, CreditCard, Plus, RefreshCw, ShoppingCart } from "lucide-react";
import { useAbility, useCurrentUser } from "@/components/auth/ability-context";
import { useTopUp } from "@/components/wallet/top-up-provider";
import { useWalletSummary } from "@/components/wallet/wallet-balance-chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { BALANCE_TONE_CLASS, balancePresentation, formatMoney as formatAmount } from "@/lib/wallet/balance";
import { formatLedgerDateTime } from "@/lib/wallet/effective-time";

interface Overview {
    wallet: { balance: number; currency: string };
    stats: {
        activationsToday: number;
        activations30d: number;
        purchasesToday: number;
        purchases30d: number;
        consumption30d: number;
        activeStores: number;
    };
    byStore: {
        storeId: string;
        storeName: string;
        isActive: boolean;
        activations30d: number;
        purchases30d: number;
    }[];
    recentActivity: {
        id: string;
        type: "ACTIVATION" | "CODE_PURCHASE";
        date: string;
        productName: string;
        storeName: string;
        requestedBy: string;
        detail: string;
        amount: number;
    }[];
}

interface CompanyOption {
    companyId: string;
    companyName: string;
}

function formatMoney(amount: number, currency: string) {
    return formatAmount(amount, currency, 2);
}

function StatCard({
    title,
    value,
    hint,
    action,
    valueClassName = "",
}: {
    title: string;
    value: ReactNode;
    hint?: string;
    action?: ReactNode;
    valueClassName?: string;
}) {
    return (
        <Card className="flex flex-col shadow-none">
            <CardHeader className="pb-2">
                <CardDescription>{title}</CardDescription>
                <CardTitle className={`text-2xl font-semibold tabular-nums ${valueClassName}`}>{value}</CardTitle>
            </CardHeader>
            <CardContent className="mt-auto space-y-3 pt-0">
                {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
                {action}
            </CardContent>
        </Card>
    );
}

/** Same reading of the balance as the wallet page: label, tone and absolute amount. */
function BalanceCard({ balance, currency, action }: { balance: number; currency: string; action?: ReactNode }) {
    const presentation = balancePresentation(balance);
    return (
        <StatCard
            title={presentation.label}
            valueClassName={BALANCE_TONE_CLASS[presentation.tone]}
            value={
                <span className="flex flex-wrap items-baseline gap-x-1.5">
                    {formatMoney(presentation.amount, currency)}
                    <span className="text-xs font-medium tracking-wide text-muted-foreground" translate="no">{currency}</span>
                </span>
            }
            hint={presentation.description}
            action={
                <div className="flex flex-wrap items-center gap-2">
                    {action}
                    <Button asChild size="sm" variant="ghost" className="px-2">
                        <Link href="/wallet">
                            Ver movimientos
                            <ArrowRight aria-hidden="true" className="size-4" />
                        </Link>
                    </Button>
                </div>
            }
        />
    );
}

/** Entry point to the daily actions, so nobody has to search the menu for them. */
function QuickActionsCard({ canBuy, canActivate }: { canBuy: boolean; canActivate: boolean }) {
    return (
        <Card className="flex flex-col justify-between shadow-none md:col-span-2">
            <CardHeader>
                <CardTitle className="text-xl">Compra de códigos</CardTitle>
                <CardDescription className="max-w-md">
                    Elige producto, región y cantidad. Los códigos quedan disponibles al instante en el historial de compras.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
                {canBuy && (
                    <Button asChild size="lg">
                        <Link href="/codes/purchase">
                            <ShoppingCart aria-hidden="true" className="size-4" />
                            Comprar códigos
                        </Link>
                    </Button>
                )}
                {canActivate && (
                    <Button asChild size="lg" variant="outline">
                        <Link href="/activate">
                            <CreditCard aria-hidden="true" className="size-4" />
                            Activar tarjeta
                        </Link>
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}

/** Misma forma que el resumen cargado (acciones + saldo + consumo, KPIs, tablas) para que no salte. */
function OverviewSkeleton() {
    return (
        <div role="status" aria-live="polite" className="space-y-6">
            <span className="sr-only">Cargando resumen…</span>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Skeleton className="h-44 rounded-xl md:col-span-2" />
                <Skeleton className="h-44 rounded-xl" />
                <Skeleton className="h-44 rounded-xl" />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
                {Array.from({ length: 3 }, (_, index) => (
                    <Skeleton key={index} className="h-32 rounded-xl" />
                ))}
            </div>
            <div className="grid gap-6 lg:grid-cols-3">
                <Skeleton className="h-72 rounded-xl" />
                <Skeleton className="h-72 rounded-xl lg:col-span-2" />
            </div>
        </div>
    );
}

export default function CompanyOverviewPage() {
    const ability = useAbility();
    const currentUser = useCurrentUser();
    const isPlatform = currentUser?.role === "SUPER_ADMIN" || currentUser?.role === "SYSTEM_ADMIN";

    const [data, setData] = useState<Overview | null>(null);
    const [companies, setCompanies] = useState<CompanyOption[]>([]);
    const [companyId, setCompanyId] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const requestSequenceRef = useRef(0);
    const { canTopUp, openTopUp } = useTopUp();
    const { data: walletSummary } = useWalletSummary();
    // Same rule as the top bar: offered only when DevDiem can complete it.
    const topUpReady = !isPlatform && canTopUp && walletSummary?.topUpsAvailable === true;

    const fetchOverview = useCallback(async (cId?: string) => {
        // Plataforma cambiando de compañía rápido: una respuesta vieja no puede mostrar
        // los datos de otra empresa bajo el nombre de la seleccionada.
        const requestId = ++requestSequenceRef.current;
        setLoading(true);
        setError(null);
        try {
            const qs = cId ? `?companyId=${encodeURIComponent(cId)}` : "";
            const res = await fetch(`/api/company/overview${qs}`, { cache: "no-store" });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json.message || "Error cargando resumen");
            if (requestId !== requestSequenceRef.current) return;
            setData(json);
        } catch (e: unknown) {
            if (requestId !== requestSequenceRef.current) return;
            const message = e instanceof Error ? e.message : "Error cargando resumen";
            setError(message);
            toast.error(message);
        } finally {
            if (requestId === requestSequenceRef.current) setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!ability.can("read", "Company")) return;
        if (isPlatform) {
            fetch("/api/wallets")
                .then((r) => r.json())
                .then((d) => setCompanies((d.wallets ?? []).map((w: any) => ({ companyId: w.companyId, companyName: w.companyName }))))
                .catch(() => { })
                .finally(() => setLoading(false));
        } else {
            fetchOverview();
        }
    }, [ability, isPlatform, fetchOverview]);

    useEffect(() => {
        if (!isPlatform || !companyId) return;
        // Otra compañía: no mostrar la anterior mientras carga.
        setData(null);
        void fetchOverview(companyId);
    }, [isPlatform, companyId, fetchOverview]);

    if (!ability.can("read", "Company")) {
        return <div className="p-8">No tienes permisos para ver esta página.</div>;
    }

    return (
        <div className="mx-auto w-full max-w-[1440px] space-y-6 p-4 sm:p-6 lg:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-balance">Mi Empresa</h1>
                    <p className="mt-2 text-sm text-muted-foreground">Resumen de tus locales, compras y activaciones.</p>
                </div>
                {isPlatform && (
                    <Select value={companyId} onValueChange={setCompanyId}>
                        <SelectTrigger className="w-full sm:w-64">
                            <SelectValue placeholder="Seleccionar compañía..." />
                        </SelectTrigger>
                        <SelectContent>
                            {companies.map((c) => (
                                <SelectItem key={c.companyId} value={c.companyId}>
                                    {c.companyName}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
            </div>

            {isPlatform && !companyId ? (
                <div className="text-center text-muted-foreground py-16">
                    Selecciona una compañía para ver su resumen.
                </div>
            ) : error && !data ? (
                <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
                    <p>{error}</p>
                    <Button variant="outline" size="sm" onClick={() => void fetchOverview(isPlatform ? companyId : undefined)}>
                        <RefreshCw aria-hidden="true" className="size-4" />
                        Reintentar
                    </Button>
                </div>
            ) : loading && !data ? (
                <OverviewSkeleton />
            ) : !data ? null : (
                <>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        {!isPlatform && (
                            <QuickActionsCard
                                canBuy={ability.can("create", "CodePurchase")}
                                canActivate={ability.can("activate", "Card")}
                            />
                        )}
                        <BalanceCard
                            // Empresa: misma fuente que el chip de la barra superior (se actualiza
                            // solo y al acreditar recargas), para que ambos saldos coincidan.
                            balance={!isPlatform && walletSummary ? walletSummary.balance : data.wallet.balance}
                            currency={!isPlatform && walletSummary ? walletSummary.currency : data.wallet.currency}
                            action={topUpReady ? (
                                <Button size="sm" className="rounded-full" onClick={() => openTopUp()}>
                                    <Plus aria-hidden="true" className="size-4" />
                                    Recargar saldo
                                </Button>
                            ) : undefined}
                        />
                        <StatCard
                            title="Consumo 30 días"
                            value={formatMoney(data.stats.consumption30d, data.wallet.currency)}
                            hint="Consumos confirmados de todos los locales."
                        />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                        <StatCard
                            title="Compras de códigos · 30 días"
                            value={data.stats.purchases30d}
                            hint={`${data.stats.purchasesToday} hoy`}
                        />
                        <StatCard
                            title="Activaciones · 30 días"
                            value={data.stats.activations30d}
                            hint={`${data.stats.activationsToday} hoy`}
                        />
                        <StatCard
                            title="Locales activos"
                            value={data.stats.activeStores}
                            hint={`de ${data.byStore.length} registrados`}
                        />
                    </div>

                    <div className="grid gap-6 lg:grid-cols-3">
                        <Card className="shadow-none">
                            <CardHeader>
                                <CardTitle>Por local (últimos 30 días)</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Local</TableHead>
                                            <TableHead className="text-right">Activaciones</TableHead>
                                            <TableHead className="text-right">Compras</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {data.byStore.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={3} className="text-center h-20">Sin locales.</TableCell>
                                            </TableRow>
                                        ) : (
                                            data.byStore.map((s) => (
                                                <TableRow key={s.storeId}>
                                                    <TableCell className="font-medium">
                                                        {s.storeName}
                                                        {!s.isActive && (
                                                            <Badge variant="secondary" className="ml-2 font-normal">Inactivo</Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums">{s.activations30d}</TableCell>
                                                    <TableCell className="text-right tabular-nums">{s.purchases30d}</TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                        <Card className="shadow-none lg:col-span-2">
                            <CardHeader>
                                <CardTitle>Actividad reciente</CardTitle>
                                <CardDescription>Solicitudes de todos los locales, en hora de Colombia.</CardDescription>
                            </CardHeader>
                            <CardContent className="overflow-x-auto">
                                <Table className="min-w-[640px]">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-40">Fecha</TableHead>
                                            <TableHead>Tipo</TableHead>
                                            <TableHead>Producto</TableHead>
                                            <TableHead>Local</TableHead>
                                            <TableHead>Solicitó</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {data.recentActivity.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center h-20">Sin actividad aún.</TableCell>
                                            </TableRow>
                                        ) : (
                                            data.recentActivity.map((a) => (
                                                <TableRow key={`${a.type}-${a.id}`}>
                                                    <TableCell className="w-40 text-xs">
                                                        <time dateTime={a.date} className="whitespace-nowrap">{formatLedgerDateTime(a.date)}</time>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span
                                                            className={`whitespace-nowrap rounded px-2 py-1 text-xs ${a.type === "ACTIVATION"
                                                                ? "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300"
                                                                : "bg-purple-100 text-purple-800 dark:bg-purple-500/15 dark:text-purple-300"
                                                                }`}
                                                        >
                                                            {a.type === "ACTIVATION" ? "Activación" : "Códigos"}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div>{a.productName}</div>
                                                        <div className="mt-0.5 text-xs text-muted-foreground">{a.detail}</div>
                                                    </TableCell>
                                                    <TableCell>{a.storeName}</TableCell>
                                                    <TableCell className="max-w-32 truncate">{a.requestedBy}</TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </div>
                </>
            )}
        </div>
    );
}
