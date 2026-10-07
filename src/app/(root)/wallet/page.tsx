"use client";

import { useCallback, useEffect, useState } from "react";
import { useAbility } from "@/components/auth/ability-context";
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
import { toast } from "sonner";
import { AccountStatementsPanel } from "@/components/account-statements/AccountStatementsPanel";
import { formatWalletRunningBalance } from "@/lib/wallet/presentation";

interface WalletTx {
    id: string;
    type: "OPENING_BALANCE" | "RECHARGE" | "CONSUMPTION" | "ADJUSTMENT" | "REFUND";
    status: "PENDING" | "CONFIRMED" | "FAILED";
    amount: number;
    balanceAfter: number | null;
    originalAmount: number | null;
    originalCurrency: string | null;
    description: string | null;
    displayDescription: string;
    originDescription: string | null;
    externalReference: string | null;
    createdAt: string;
    occurredAt: string;
}

interface WalletData {
    wallet: { currency: string; balance: number };
    transactions: WalletTx[];
    pagination: { page: number; pageSize: number; total: number };
}

const TYPE_LABELS: Record<WalletTx["type"], string> = {
    OPENING_BALANCE: "Saldo anterior",
    RECHARGE: "Abono",
    CONSUMPTION: "Consumo",
    ADJUSTMENT: "Ajuste",
    REFUND: "Reembolso",
};

function formatMoney(amount: number, currency: string) {
    return new Intl.NumberFormat("es-CO", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
}

function balancePresentation(balance: number) {
    if (balance < 0) {
        return {
            label: "Total pendiente",
            description: "Consumos confirmados pendientes de abono a Vercode.",
            amount: Math.abs(balance),
            tone: "text-red-700",
        };
    }
    if (balance > 0) {
        return {
            label: "Saldo a favor",
            description: "Saldo disponible para cubrir próximos consumos.",
            amount: balance,
            tone: "text-emerald-700",
        };
    }
    return {
        label: "Cuenta al día",
        description: "No tienes saldo pendiente ni saldo a favor.",
        amount: 0,
        tone: "text-[#123f68]",
    };
}

export default function CompanyWalletPage() {
    const ability = useAbility();
    const [data, setData] = useState<WalletData | null>(null);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);

    const fetchWallet = useCallback(async (p: number) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/wallets?page=${p}`);
            if (!res.ok) throw new Error();
            const json = await res.json();
            if (json.scope !== "company") {
                // Usuario de plataforma: esta vista es para compañías.
                setData(null);
                return;
            }
            setData(json);
        } catch {
            toast.error("Error cargando la wallet");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (ability.can("read", "Wallet")) {
            fetchWallet(page);
        }
    }, [ability, page, fetchWallet]);

    if (!ability.can("read", "Wallet")) {
        return <div className="p-8">No tienes permisos para ver esta página.</div>;
    }

    const totalPages = data ? Math.max(1, Math.ceil(data.pagination.total / data.pagination.pageSize)) : 1;

    return (
        <div className="mx-auto w-full max-w-[1440px] space-y-6 p-4 sm:p-6 lg:p-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-balance">Mi cuenta</h1>
                <p className="mt-2 text-sm text-muted-foreground">Consulta el saldo, los estados emitidos y cada movimiento confirmado.</p>
            </div>

            <Card className="overflow-hidden shadow-none">
                <CardHeader>
                    <CardTitle>{data ? balancePresentation(data.wallet.balance).label : "Saldo de la cuenta"}</CardTitle>
                    <CardDescription>{data ? balancePresentation(data.wallet.balance).description : "Resumen financiero de tu cuenta comercial."}</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading && !data ? (
                        <div className="text-muted-foreground" role="status">Cargando…</div>
                    ) : data ? (
                        <div
                            className={`flex flex-wrap items-baseline gap-x-2 text-4xl font-bold tabular-nums ${balancePresentation(data.wallet.balance).tone}`}
                        >
                            {formatMoney(balancePresentation(data.wallet.balance).amount, data.wallet.currency)}
                            <span className="text-sm font-medium tracking-wide text-muted-foreground" translate="no">
                                {data.wallet.currency}
                            </span>
                        </div>
                    ) : (
                        <div className="text-muted-foreground">Esta vista es para usuarios de compañía.</div>
                    )}
                </CardContent>
            </Card>

            {data ? <AccountStatementsPanel /> : null}

            <Card className="shadow-none">
                <CardHeader>
                    <CardTitle>Movimientos</CardTitle>
                    <CardDescription>Débitos, abonos y balance resultante en orden cronológico.</CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                    <Table className="min-w-[760px]">
                        <TableHeader>
                            <TableRow>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Descripción</TableHead>
                                <TableHead className="text-right">Monto</TableHead>
                                <TableHead className="text-right">Balance</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center" role="status">Cargando…</TableCell>
                                </TableRow>
                            ) : !data || data.transactions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-24">Sin movimientos aún.</TableCell>
                                </TableRow>
                            ) : (
                                data.transactions.map((tx) => {
                                    const isDebit = tx.type === "CONSUMPTION" || tx.type === "OPENING_BALANCE";
                                    return (
                                        <TableRow key={tx.id}>
                                            <TableCell className="whitespace-nowrap">
                                                {new Date(tx.occurredAt).toLocaleString("es-CO")}
                                            </TableCell>
                                            <TableCell>
                                                <span
                                                    className={`px-2 py-1 rounded text-xs ${
                                                        tx.status === "PENDING"
                                                            ? "bg-yellow-100 text-yellow-800"
                                                            : isDebit
                                                              ? "bg-red-100 text-red-800"
                                                              : "bg-green-100 text-green-800"
                                                    }`}
                                                >
                                                    {TYPE_LABELS[tx.type]}
                                                    {tx.status === "PENDING" && " (pendiente)"}
                                                </span>
                                            </TableCell>
                                            <TableCell className="max-w-md" title={tx.description ?? tx.externalReference ?? undefined}>
                                                <div>{tx.displayDescription}</div>
                                                {tx.originDescription ? (
                                                    <div className="mt-0.5 text-xs text-muted-foreground">
                                                        {tx.originDescription}
                                                    </div>
                                                ) : null}
                                            </TableCell>
                                            <TableCell
                                                className={`text-right tabular-nums ${isDebit ? "text-red-700" : "text-emerald-700"}`}
                                            >
                                                {tx.type === "OPENING_BALANCE"
                                                    ? formatMoney(tx.amount, data.wallet.currency)
                                                    : tx.status === "PENDING" && tx.originalAmount != null
                                                    ? `${tx.originalAmount} ${tx.originalCurrency ?? ""} (sin tasa)`
                                                    : `${isDebit ? "−" : "+"}${formatMoney(tx.amount, data.wallet.currency)}`}
                                            </TableCell>
                                            <TableCell className={`whitespace-nowrap text-right text-sm tabular-nums ${
                                                tx.balanceAfter != null && tx.balanceAfter < 0
                                                    ? "font-medium text-red-700"
                                                    : "text-emerald-700"
                                            }`}>
                                                {tx.balanceAfter != null
                                                    ? formatWalletRunningBalance(tx.balanceAfter, data.wallet.currency)
                                                    : "—"}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>

                    {data && totalPages > 1 && (
                        <div className="flex justify-end items-center gap-2 pt-4">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page <= 1 || loading}
                                onClick={() => setPage((p) => p - 1)}
                            >
                                Anterior
                            </Button>
                            <span className="text-sm text-muted-foreground">
                                Página {page} de {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page >= totalPages || loading}
                                onClick={() => setPage((p) => p + 1)}
                            >
                                Siguiente
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
