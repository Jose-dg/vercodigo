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

interface WalletTx {
    id: string;
    type: "RECHARGE" | "CONSUMPTION" | "ADJUSTMENT" | "REFUND";
    status: "PENDING" | "CONFIRMED" | "FAILED";
    amount: number;
    balanceAfter: number | null;
    originalAmount: number | null;
    originalCurrency: string | null;
    description: string | null;
    externalReference: string | null;
    createdAt: string;
}

interface WalletData {
    wallet: { currency: string; balance: number };
    transactions: WalletTx[];
    pagination: { page: number; pageSize: number; total: number };
}

const TYPE_LABELS: Record<WalletTx["type"], string> = {
    RECHARGE: "Abono",
    CONSUMPTION: "Consumo",
    ADJUSTMENT: "Ajuste",
    REFUND: "Reembolso",
};

function formatMoney(amount: number, currency: string) {
    return new Intl.NumberFormat("es-CO", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
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
        <div className="p-6 space-y-6">
            <h1 className="text-3xl font-bold tracking-tight">Mi Wallet</h1>

            <Card>
                <CardHeader>
                    <CardTitle>Balance actual</CardTitle>
                    <CardDescription>
                        Balance negativo indica saldo pendiente por abonar a la plataforma.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading && !data ? (
                        <div className="text-muted-foreground">Cargando...</div>
                    ) : data ? (
                        <div
                            className={`text-4xl font-bold font-mono ${data.wallet.balance < 0 ? "text-red-600" : "text-green-700"}`}
                        >
                            {formatMoney(data.wallet.balance, data.wallet.currency)}
                            <span className="ml-2 text-base font-normal text-muted-foreground">
                                {data.wallet.currency}
                            </span>
                        </div>
                    ) : (
                        <div className="text-muted-foreground">Esta vista es para usuarios de compañía.</div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Movimientos</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
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
                                    <TableCell colSpan={5} className="text-center h-24">Cargando...</TableCell>
                                </TableRow>
                            ) : !data || data.transactions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-24">Sin movimientos aún.</TableCell>
                                </TableRow>
                            ) : (
                                data.transactions.map((tx) => {
                                    const isDebit = tx.type === "CONSUMPTION";
                                    return (
                                        <TableRow key={tx.id}>
                                            <TableCell className="whitespace-nowrap">
                                                {new Date(tx.createdAt).toLocaleString("es-CO")}
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
                                            <TableCell className="max-w-md truncate">
                                                {tx.description ?? tx.externalReference ?? "—"}
                                            </TableCell>
                                            <TableCell
                                                className={`text-right font-mono ${isDebit ? "text-red-600" : "text-green-700"}`}
                                            >
                                                {tx.status === "PENDING" && tx.originalAmount != null
                                                    ? `${tx.originalAmount} ${tx.originalCurrency ?? ""} (sin tasa)`
                                                    : `${isDebit ? "-" : "+"}${formatMoney(tx.amount, data.wallet.currency)}`}
                                            </TableCell>
                                            <TableCell className="text-right font-mono">
                                                {tx.balanceAfter != null
                                                    ? formatMoney(tx.balanceAfter, data.wallet.currency)
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
