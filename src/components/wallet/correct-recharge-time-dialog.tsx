"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/wallet/balance";
import { bogotaLocalNow, bogotaLocalToIso, formatLedgerDateTime } from "@/lib/wallet/effective-time";
import { formatWalletRunningBalance } from "@/lib/wallet/presentation";
import type { WalletMovement, WalletMovementType } from "./wallet-movements-table";

type PreviewLine = {
    id: string;
    type: WalletMovementType;
    amount: number;
    occurredAt: string;
    balanceBefore: number | null;
    balanceAfter: number | null;
};

type Preview = {
    previousOccurredAt: string;
    occurredAt: string;
    lines: PreviewLine[];
    finalBalanceBefore: number;
    finalBalanceAfter: number;
    newlyNegative: number;
};

const TYPE_LABELS: Record<WalletMovementType, string> = {
    OPENING_BALANCE: "Saldo anterior",
    RECHARGE: "Abono",
    CONSUMPTION: "Consumo",
    ADJUSTMENT: "Ajuste",
    REFUND: "Reembolso",
};

function balance(value: number | null, currency: string) {
    return value == null ? "—" : formatWalletRunningBalance(value, currency);
}

/**
 * Corrects the payment time of a manual top-up. Moving it re-sorts the ledger,
 * so the admin first sees which running balances change, then applies.
 */
export function CorrectRechargeTimeDialog({
    movement,
    currency,
    onOpenChange,
    onCorrected,
}: {
    movement: WalletMovement | null;
    currency: string;
    onOpenChange: (open: boolean) => void;
    onCorrected: () => void;
}) {
    const [paidAt, setPaidAt] = useState("");
    const [reason, setReason] = useState("");
    const [preview, setPreview] = useState<Preview | null>(null);
    const [previewFor, setPreviewFor] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!movement) return;
        setPaidAt(bogotaLocalNow(new Date(movement.occurredAt)));
        setReason("");
        setPreview(null);
        setPreviewFor("");
    }, [movement]);

    if (!movement) return null;
    // A top-up without payment time may be confirmed at its registration time.
    const missingPaidAt = movement.occurredAtSource === "REGISTRATION_ONLY";
    const unchanged = !missingPaidAt && paidAt === bogotaLocalNow(new Date(movement.occurredAt));
    // A preview is valid only for the time it was computed for.
    const previewCurrent = preview !== null && previewFor === paidAt;

    const isoOrToast = () => {
        try {
            return bogotaLocalToIso(paidAt);
        } catch {
            toast.error("Ingresa la fecha y hora del pago");
            return null;
        }
    };

    const loadPreview = async () => {
        const iso = isoOrToast();
        if (!iso) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/wallets/transactions/${encodeURIComponent(movement.id)}/paid-at/preview`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ paidAt: iso }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.message || "No se pudo calcular el impacto");
            setPreview(body.preview);
            setPreviewFor(paidAt);
        } catch (error) {
            setPreview(null);
            toast.error(error instanceof Error ? error.message : "No se pudo calcular el impacto");
        } finally {
            setLoading(false);
        }
    };

    const apply = async () => {
        const iso = isoOrToast();
        if (!iso) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/wallets/transactions/${encodeURIComponent(movement.id)}/paid-at`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ paidAt: iso, expectedOccurredAt: movement.occurredAt, reason: reason.trim() }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.message || "No se pudo corregir la hora");
            toast.success("Hora del pago corregida y saldos recalculados");
            onCorrected();
            onOpenChange(false);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "No se pudo corregir la hora");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{missingPaidAt ? "Registrar hora del pago" : "Corregir hora del pago"}</DialogTitle>
                    <DialogDescription>
                        {movement.displayDescription} · +{formatMoney(movement.amount, currency, 2)} · {missingPaidAt ? "sin hora de pago, registrada el" : "registrada como"}{" "}
                        {formatLedgerDateTime(movement.occurredAt)}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <Label htmlFor="corrected-paid-at">Fecha y hora real del pago (hora Colombia)</Label>
                            <Input
                                id="corrected-paid-at"
                                className="mt-1"
                                type="datetime-local"
                                value={paidAt}
                                max={bogotaLocalNow()}
                                onChange={(event) => setPaidAt(event.target.value)}
                            />
                        </div>
                        <div>
                            <Label htmlFor="corrected-paid-at-reason">Motivo obligatorio</Label>
                            <Input
                                id="corrected-paid-at-reason"
                                className="mt-1"
                                value={reason}
                                maxLength={500}
                                placeholder="Ej. el comprobante dice 10/oct 9:30"
                                onChange={(event) => setReason(event.target.value)}
                            />
                        </div>
                    </div>

                    {previewCurrent ? (
                        <div className="space-y-2">
                            <p className="text-sm">
                                {preview.lines.length === 0
                                    ? "Ningún saldo cambia: el abono no cruza otros movimientos."
                                    : `Cambian ${preview.lines.length} saldos. El saldo final sigue en ${balance(preview.finalBalanceAfter, currency)}.`}
                            </p>
                            {preview.newlyNegative > 0 ? (
                                <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
                                    {preview.newlyNegative} movimiento(s) quedarían con saldo negativo en ese momento.
                                </p>
                            ) : null}
                            {preview.lines.length > 0 ? (
                                <div className="max-h-72 overflow-auto rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Fecha</TableHead>
                                                <TableHead>Tipo</TableHead>
                                                <TableHead className="text-right">Saldo antes</TableHead>
                                                <TableHead className="text-right">Saldo después</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {preview.lines.map((line) => (
                                                <TableRow key={line.id} data-state={line.id === movement.id ? "selected" : undefined}>
                                                    <TableCell className="whitespace-nowrap">{formatLedgerDateTime(line.occurredAt)}</TableCell>
                                                    <TableCell>{line.id === movement.id ? "Este abono" : TYPE_LABELS[line.type]}</TableCell>
                                                    <TableCell className="text-right tabular-nums text-muted-foreground">{balance(line.balanceBefore, currency)}</TableCell>
                                                    <TableCell className="text-right tabular-nums">{balance(line.balanceAfter, currency)}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            ) : null}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            Calcula el impacto para ver qué saldos cambian antes de aplicar. El monto y la referencia no cambian.
                        </p>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
                    <Button variant="outline" onClick={loadPreview} disabled={loading || unchanged || !paidAt}>
                        Ver impacto
                    </Button>
                    <Button onClick={apply} disabled={loading || unchanged || !previewCurrent || reason.trim().length < 3}>
                        Aplicar corrección
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
