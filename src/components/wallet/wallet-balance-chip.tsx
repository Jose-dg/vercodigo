"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import useSWR, { useSWRConfig } from "swr";
import { toast } from "sonner";
import { Clock, RefreshCw, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { BALANCE_TONE_CLASS, balancePresentation, formatMoney } from "@/lib/wallet/balance";
import { cn } from "@/lib/utils";

export const WALLET_SUMMARY_KEY = "/api/wallet/summary";

type WalletSummary = {
    currency: string;
    balance: number;
    openTopUps: { count: number; total: number } | null;
};

async function fetchSummary(url: string): Promise<WalletSummary> {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
}

export function useWalletSummary() {
    return useSWR<WalletSummary>(WALLET_SUMMARY_KEY, fetchSummary, {
        refreshInterval: 60_000,
        revalidateOnFocus: true,
    });
}

/**
 * Announces a credited top-up even when the dialog is closed: in-flight
 * top-ups went down and the balance went up since the previous refresh.
 */
function useCreditedAnnouncement(data: WalletSummary | undefined) {
    const previous = useRef<WalletSummary | undefined>(undefined);
    const { mutate } = useSWRConfig();
    useEffect(() => {
        const before = previous.current;
        previous.current = data;
        if (!before || !data || !before.openTopUps || !data.openTopUps) return;
        if (data.openTopUps.count < before.openTopUps.count && data.balance > before.balance) {
            toast.success(`Recarga acreditada: +${formatMoney(data.balance - before.balance, data.currency)}`);
            mutate("/api/wallet/topups");
        }
    }, [data, mutate]);
}

export function WalletBalanceChip({ onTopUp }: { onTopUp?: () => void }) {
    const { data, error, isLoading, mutate } = useWalletSummary();
    useCreditedAnnouncement(data);

    if (isLoading) {
        return <Skeleton className="h-9 w-44 rounded-full" aria-label="Cargando saldo" />;
    }
    if (error || !data) {
        return (
            <Button variant="outline" size="sm" className="h-9 rounded-full" onClick={() => mutate()}>
                <RefreshCw aria-hidden="true" className="size-4" />
                Saldo no disponible
            </Button>
        );
    }

    const presentation = balancePresentation(data.balance);
    const amount = formatMoney(presentation.amount, data.currency);
    const open = data.openTopUps;

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    aria-label={`${presentation.label}: ${amount}. Ver detalle`}
                    className="group inline-flex h-9 items-center gap-2 rounded-full border bg-card px-3 text-sm shadow-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    <Wallet aria-hidden="true" className="size-4 text-muted-foreground" />
                    <span className="hidden text-muted-foreground sm:inline">{presentation.shortLabel}</span>
                    <span className={cn("font-semibold tabular-nums", BALANCE_TONE_CLASS[presentation.tone])}>
                        {amount}
                    </span>
                    {open && open.count > 0 ? (
                        <span className="relative flex size-2" aria-label={`${open.count} recarga(s) en curso`}>
                            <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-60 motion-reduce:animate-none" />
                            <span className="relative inline-flex size-2 rounded-full bg-amber-500" />
                        </span>
                    ) : null}
                </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
                <div className="space-y-1 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {presentation.label}
                    </p>
                    <p className={cn("text-2xl font-bold tabular-nums", BALANCE_TONE_CLASS[presentation.tone])}>
                        {amount}
                        <span className="ml-1 text-xs font-medium text-muted-foreground" translate="no">
                            {data.currency}
                        </span>
                    </p>
                    <p className="text-sm text-muted-foreground">{presentation.description}</p>
                </div>
                {open && open.count > 0 ? (
                    <div className="flex items-start gap-2 border-t bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                        <Clock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                        <span>
                            {open.count === 1 ? "1 recarga en curso" : `${open.count} recargas en curso`} por{" "}
                            <strong className="tabular-nums">{formatMoney(open.total, data.currency)}</strong>. Se
                            suma a tu saldo cuando finanzas la confirme.
                        </span>
                    </div>
                ) : null}
                <div className="flex items-center justify-between gap-2 border-t p-3">
                    <Button asChild variant="ghost" size="sm">
                        <Link href="/wallet">Ver movimientos</Link>
                    </Button>
                    {onTopUp ? (
                        <Button size="sm" onClick={onTopUp}>
                            Recargar saldo
                        </Button>
                    ) : null}
                </div>
            </PopoverContent>
        </Popover>
    );
}
