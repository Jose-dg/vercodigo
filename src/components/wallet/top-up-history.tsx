"use client";

import useSWR from "swr";
import { Paperclip, Plus, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { TopUp } from "@/lib/devdiem/stored-value";
import { formatMoney } from "@/lib/wallet/balance";
import { evidenceCountLabel } from "@/lib/wallet/topup-evidence";
import { shortTopUpReference, timeRemaining, topUpStatePresentation } from "@/lib/wallet/topups";
import { cn } from "@/lib/utils";

import { WALLET_TOPUPS_KEY } from "./top-up-dialog";
import { useTopUp } from "./top-up-provider";
import { formatLedgerDate } from "@/lib/wallet/effective-time";
import { useWalletSummary } from "./wallet-balance-chip";

const TONE_CLASS = {
    pending: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
    review: "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200",
    success: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
    muted: "text-muted-foreground",
} as const;

async function fetchTopUps(url: string): Promise<TopUp[]> {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()).topUps;
}

/** The company's top-ups, read from DevDiem; resume a payment or follow one. */
export function TopUpHistory() {
    const { canTopUp, openTopUp } = useTopUp();
    const { data: summary } = useWalletSummary();
    const available = summary?.topUpsAvailable === true;
    const { data, error, isLoading, mutate } = useSWR(canTopUp && available ? WALLET_TOPUPS_KEY : null, fetchTopUps, {
        refreshInterval: 30_000,
    });
    if (!canTopUp) return null;
    if (summary && !available) {
        return (
            <Card id="recargas" className="scroll-mt-20 shadow-none">
                <CardHeader>
                    <CardTitle>Recargas</CardTitle>
                    <CardDescription>
                        Las recargas por Bre-B no están disponibles por ahora. Mientras tanto, tu saldo se sigue
                        actualizando con los abonos registrados por Vercode.
                    </CardDescription>
                </CardHeader>
            </Card>
        );
    }

    return (
        <Card id="recargas" className="scroll-mt-20 shadow-none">
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div className="space-y-1">
                    <CardTitle>Recargas</CardTitle>
                    <CardDescription>Transferencias Bre-B para sumar saldo a tu cuenta.</CardDescription>
                </div>
                {available ? (
                    <Button size="sm" onClick={() => openTopUp()}>
                        <Plus className="size-4" aria-hidden="true" /> Recargar
                    </Button>
                ) : null}
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="space-y-2" aria-label="Cargando recargas">
                        <Skeleton className="h-14 w-full" />
                        <Skeleton className="h-14 w-full" />
                    </div>
                ) : error ? (
                    <div className="flex items-center justify-between rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                        No pudimos cargar tus recargas.
                        <Button variant="ghost" size="sm" onClick={() => mutate()}>
                            <RefreshCw className="size-4" aria-hidden="true" /> Reintentar
                        </Button>
                    </div>
                ) : !data || data.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                        Aún no has hecho recargas. Recarga para tener saldo disponible en tus próximas compras.
                    </div>
                ) : (
                    <ul className="divide-y rounded-lg border">
                        {data.map((topUp) => {
                            const state = topUpStatePresentation(topUp.state);
                            const payable = topUp.state === "created" && !timeRemaining(topUp.expires_at).expired;
                            const receipts = topUp.evidence_count ?? 0;
                            return (
                                <li key={topUp.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                                    <div className="min-w-0 flex-1">
                                        <p className="font-semibold tabular-nums">
                                            {formatMoney(Number(topUp.amount), topUp.currency)}
                                        </p>
                                        <p className="font-mono text-xs text-muted-foreground">
                                            {shortTopUpReference(topUp.id)}
                                            {topUp.created_at
                                                ? ` · ${formatLedgerDate(topUp.created_at)}`
                                                : ""}
                                            {receipts > 0 ? (
                                                <span className="ml-1.5 inline-flex items-center gap-0.5 align-middle" title={evidenceCountLabel(receipts)}>
                                                    <Paperclip className="size-3" aria-hidden="true" />
                                                    <span className="sr-only">{evidenceCountLabel(receipts)}</span>
                                                    <span aria-hidden="true">{receipts}</span>
                                                </span>
                                            ) : null}
                                        </p>
                                    </div>
                                    <Badge variant="outline" className={cn("font-medium", TONE_CLASS[state.tone])}>
                                        {state.label}
                                    </Badge>
                                    {payable ? (
                                        <Button size="sm" onClick={() => openTopUp(topUp)}>
                                            Continuar pago
                                        </Button>
                                    ) : state.isOpen ? (
                                        <Button size="sm" variant="outline" onClick={() => openTopUp(topUp)}>
                                            {topUp.state === "under_review" && receipts === 0 ? "Adjuntar comprobante" : "Ver estado"}
                                        </Button>
                                    ) : null}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </CardContent>
        </Card>
    );
}
