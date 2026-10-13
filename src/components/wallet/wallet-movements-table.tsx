"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { formatMoney as formatAmount } from "@/lib/wallet/balance";
import { formatLedgerDateTime, isCorrectableRecharge, type WalletTimeSource } from "@/lib/wallet/effective-time";
import { formatWalletRunningBalance } from "@/lib/wallet/presentation";

export type WalletMovementType = "OPENING_BALANCE" | "RECHARGE" | "CONSUMPTION" | "ADJUSTMENT" | "REFUND";

export interface WalletMovement {
    id: string;
    type: WalletMovementType;
    status: "PENDING" | "CONFIRMED" | "FAILED";
    method: "MANUAL" | "PSE" | "CREDIT_CARD" | "BRE_B" | null;
    amount: number;
    balanceAfter: number | null;
    originalAmount: number | null;
    originalCurrency: string | null;
    description: string | null;
    displayDescription: string;
    originDescription: string | null;
    externalReference: string | null;
    /** When the row was written; never shown as the time of the movement. */
    createdAt: string;
    /** Effective time: what the list shows and sorts by. */
    occurredAt: string;
    occurredAtSource: WalletTimeSource;
    effectiveTimeLabel: string | null;
}

export interface WalletMovementsPage {
    scope: "company" | "platform";
    wallet: { currency: string; balance: number };
    transactions: WalletMovement[];
    pagination: { page: number; pageSize: number; total: number };
}

const TYPE_LABELS: Record<WalletMovementType, string> = {
    OPENING_BALANCE: "Saldo anterior",
    RECHARGE: "Abono",
    CONSUMPTION: "Consumo",
    ADJUSTMENT: "Ajuste",
    REFUND: "Reembolso",
};

const ALL_TYPES = "ALL";

function formatMoney(amount: number, currency: string) {
    return formatAmount(amount, currency, 2);
}

/**
 * Loads one page of wallet movements from `endpoint` (GET /api/wallets for
 * the company, GET /api/wallets/:companyId/transactions for the platform).
 */
export function useWalletMovements(endpoint: string | null) {
    const [data, setData] = useState<WalletMovementsPage | null>(null);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [type, setType] = useState<WalletMovementType | typeof ALL_TYPES>(ALL_TYPES);

    const load = useCallback(async () => {
        if (!endpoint) return;
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page) });
            if (type !== ALL_TYPES) params.set("type", type);
            const response = await fetch(`${endpoint}?${params}`, { cache: "no-store" });
            if (!response.ok) throw new Error();
            const json = await response.json();
            setData(json.transactions ? json : null);
        } catch {
            toast.error("Error cargando los movimientos");
        } finally {
            setLoading(false);
        }
    }, [endpoint, page, type]);

    useEffect(() => {
        void load();
    }, [load]);

    const changeType = useCallback((value: WalletMovementType | typeof ALL_TYPES) => {
        setType(value);
        setPage(1);
    }, []);

    return { data, loading, page, setPage, type, setType: changeType, reload: load };
}

export function WalletMovementsTable({
    movements,
    onCorrectPaidAt,
}: {
    movements: ReturnType<typeof useWalletMovements>;
    /** Platform only: opens the payment-time correction of a manual top-up. */
    onCorrectPaidAt?: (movement: WalletMovement) => void;
}) {
    const { data, loading, page, setPage, type, setType } = movements;
    const totalPages = data ? Math.max(1, Math.ceil(data.pagination.total / data.pagination.pageSize)) : 1;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">Fechas en hora de Colombia, ordenadas por cuándo ocurrió cada movimiento.</p>
                <Select value={type} onValueChange={(value) => setType(value as WalletMovementType | typeof ALL_TYPES)}>
                    <SelectTrigger className="w-[180px]" aria-label="Filtrar por tipo">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL_TYPES}>Todos los tipos</SelectItem>
                        {(Object.keys(TYPE_LABELS) as WalletMovementType[]).map((key) => (
                            <SelectItem key={key} value={key}>{TYPE_LABELS[key]}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="overflow-x-auto">
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
                                <TableCell colSpan={5} className="h-24 text-center">Sin movimientos.</TableCell>
                            </TableRow>
                        ) : (
                            data.transactions.map((tx) => {
                                const isDebit = tx.type === "CONSUMPTION" || tx.type === "OPENING_BALANCE";
                                return (
                                    <TableRow key={tx.id}>
                                        <TableCell className="whitespace-nowrap">
                                            <time dateTime={tx.occurredAt}>{formatLedgerDateTime(tx.occurredAt)}</time>
                                            {onCorrectPaidAt && isCorrectableRecharge(tx) ? (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="ml-1 size-6 align-middle"
                                                    title="Corregir hora del pago"
                                                    aria-label="Corregir hora del pago"
                                                    onClick={() => onCorrectPaidAt(tx)}
                                                >
                                                    <Pencil className="size-3" />
                                                </Button>
                                            ) : null}
                                            {tx.effectiveTimeLabel ? (
                                                <div
                                                    className={`mt-0.5 text-xs ${tx.occurredAtSource === "REGISTRATION_ONLY" ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}
                                                >
                                                    {tx.effectiveTimeLabel}
                                                </div>
                                            ) : null}
                                        </TableCell>
                                        <TableCell>
                                            <span
                                                className={`rounded px-2 py-1 text-xs ${
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
                                                <div className="mt-0.5 text-xs text-muted-foreground">{tx.originDescription}</div>
                                            ) : null}
                                        </TableCell>
                                        <TableCell className={`text-right tabular-nums ${isDebit ? "text-red-700" : "text-emerald-700"}`}>
                                            {tx.type === "OPENING_BALANCE"
                                                ? formatMoney(tx.amount, data.wallet.currency)
                                                : tx.status === "PENDING" && tx.originalAmount != null
                                                  ? `${tx.originalAmount} ${tx.originalCurrency ?? ""} (sin tasa)`
                                                  : `${isDebit ? "−" : "+"}${formatMoney(tx.amount, data.wallet.currency)}`}
                                        </TableCell>
                                        <TableCell
                                            className={`whitespace-nowrap text-right text-sm tabular-nums ${
                                                tx.balanceAfter != null && tx.balanceAfter < 0 ? "font-medium text-red-700" : "text-emerald-700"
                                            }`}
                                        >
                                            {tx.balanceAfter != null ? formatWalletRunningBalance(tx.balanceAfter, data.wallet.currency) : "—"}
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>
            {data && totalPages > 1 ? (
                <div className="flex items-center justify-end gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
                        Anterior
                    </Button>
                    <span className="text-sm text-muted-foreground">Página {page} de {totalPages}</span>
                    <Button variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>
                        Siguiente
                    </Button>
                </div>
            ) : null}
        </div>
    );
}
