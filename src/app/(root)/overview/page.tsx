"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { CreditCard, Plus, ShoppingCart } from "lucide-react";
import { useAbility, useCurrentUser } from "@/components/auth/ability-context";
import { useTopUp } from "@/components/wallet/top-up-provider";
import { useWalletSummary } from "@/components/wallet/wallet-balance-chip";
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
import { toast } from "sonner";

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
    return new Intl.NumberFormat("es-CO", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
}

function StatCard({
    title,
    value,
    hint,
    action,
}: {
    title: string;
    value: string | number;
    hint?: string;
    action?: ReactNode;
}) {
    return (
        <Card className="flex flex-col">
            <CardHeader className="pb-2">
                <CardDescription>{title}</CardDescription>
                <CardTitle className="text-3xl font-mono tabular-nums break-all">{value}</CardTitle>
            </CardHeader>
            <CardContent className="mt-auto space-y-3 pt-0">
                {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
                {action}
            </CardContent>
        </Card>
    );
}

/** Entry point to the daily actions, so nobody has to search the menu for them. */
function QuickActionsCard({ canBuy, canActivate }: { canBuy: boolean; canActivate: boolean }) {
    return (
        <Card className="flex flex-col justify-between lg:col-span-2">
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

export default function CompanyOverviewPage() {
    const ability = useAbility();
    const currentUser = useCurrentUser();
    const isPlatform = currentUser?.role === "SUPER_ADMIN" || currentUser?.role === "SYSTEM_ADMIN";

    const [data, setData] = useState<Overview | null>(null);
    const [companies, setCompanies] = useState<CompanyOption[]>([]);
    const [companyId, setCompanyId] = useState("");
    const [loading, setLoading] = useState(true);
    const { canTopUp, openTopUp } = useTopUp();
    const { data: walletSummary } = useWalletSummary();
    // Same rule as the top bar: offered only when DevDiem can complete it.
    const topUpReady = !isPlatform && canTopUp && walletSummary?.topUpsAvailable === true;

    const fetchOverview = useCallback(async (cId?: string) => {
        setLoading(true);
        try {
            const qs = cId ? `?companyId=${cId}` : "";
            const res = await fetch(`/api/company/overview${qs}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || "Error cargando resumen");
            setData(json);
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setLoading(false);
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
        if (isPlatform && companyId) fetchOverview(companyId);
    }, [isPlatform, companyId, fetchOverview]);

    if (!ability.can("read", "Company")) {
        return <div className="p-8">No tienes permisos para ver esta página.</div>;
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">Mi Empresa</h1>
                {isPlatform && (
                    <Select value={companyId} onValueChange={setCompanyId}>
                        <SelectTrigger className="w-64">
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
            ) : loading || !data ? (
                <div className="text-center text-muted-foreground py-16">Cargando...</div>
            ) : (
                <>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        {!isPlatform && (
                            <QuickActionsCard
                                canBuy={ability.can("create", "CodePurchase")}
                                canActivate={ability.can("activate", "Card")}
                            />
                        )}
                        <StatCard
                            title="Saldo wallet"
                            value={formatMoney(data.wallet.balance, data.wallet.currency)}
                            hint={data.wallet.balance < 0 ? "Saldo pendiente por abonar" : undefined}
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
                        />
                    </div>

                    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                        <StatCard title="Compras de códigos hoy" value={data.stats.purchasesToday} />
                        <StatCard title="Compras 30 días" value={data.stats.purchases30d} />
                        <StatCard title="Activaciones hoy" value={data.stats.activationsToday} />
                        <StatCard title="Activaciones 30 días" value={data.stats.activations30d} />
                    </div>

                    <div className="grid gap-6 lg:grid-cols-2">
                        <Card>
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
                                                            <span className="ml-2 text-xs text-red-500">(inactivo)</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono">{s.activations30d}</TableCell>
                                                    <TableCell className="text-right font-mono">{s.purchases30d}</TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Actividad reciente</CardTitle>
                                <CardDescription>Solicitudes de todos los locales.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Fecha</TableHead>
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
                                                    <TableCell className="whitespace-nowrap text-xs">
                                                        {new Date(a.date).toLocaleString("es-CO")}
                                                    </TableCell>
                                                    <TableCell>
                                                        <span
                                                            className={`px-2 py-1 rounded text-xs ${a.type === "ACTIVATION"
                                                                ? "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300"
                                                                : "bg-purple-100 text-purple-800 dark:bg-purple-500/15 dark:text-purple-300"
                                                                }`}
                                                        >
                                                            {a.type === "ACTIVATION" ? "Activación" : "Códigos"}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        {a.productName}
                                                        <span className="text-xs text-muted-foreground ml-1">{a.detail}</span>
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
