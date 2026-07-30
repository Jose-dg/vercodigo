"use client";

import { useCallback, useEffect, useState } from "react";
import { useAbility, useCurrentUser } from "@/components/auth/ability-context";
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

function StatCard({ title, value, hint }: { title: string; value: string | number; hint?: string }) {
    return (
        <Card>
            <CardHeader className="pb-2">
                <CardDescription>{title}</CardDescription>
                <CardTitle className="text-3xl font-mono">{value}</CardTitle>
            </CardHeader>
            {hint && <CardContent className="text-xs text-muted-foreground pt-0">{hint}</CardContent>}
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
                    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
                        <StatCard title="Activaciones hoy" value={data.stats.activationsToday} />
                        <StatCard title="Activaciones 30 días" value={data.stats.activations30d} />
                        <StatCard title="Compras de códigos hoy" value={data.stats.purchasesToday} />
                        <StatCard title="Compras 30 días" value={data.stats.purchases30d} />
                        <StatCard
                            title="Consumo 30 días"
                            value={formatMoney(data.stats.consumption30d, data.wallet.currency)}
                        />
                        <StatCard
                            title="Saldo wallet"
                            value={formatMoney(data.wallet.balance, data.wallet.currency)}
                            hint={data.wallet.balance < 0 ? "Saldo pendiente por abonar" : undefined}
                        />
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
                                                                ? "bg-blue-100 text-blue-800"
                                                                : "bg-purple-100 text-purple-800"
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
