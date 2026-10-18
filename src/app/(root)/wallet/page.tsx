"use client";

import { useEffect, useRef } from "react";
import { RefreshCw } from "lucide-react";

import { useAbility } from "@/components/auth/ability-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AccountStatementsPanel } from "@/components/account-statements/AccountStatementsPanel";
import { TopUpHistory } from "@/components/wallet/top-up-history";
import { useWalletSummary } from "@/components/wallet/wallet-balance-chip";
import { useWalletMovements, WalletMovementsTable } from "@/components/wallet/wallet-movements-table";
import { BALANCE_TONE_CLASS, balancePresentation, formatMoney as formatAmount } from "@/lib/wallet/balance";

function formatMoney(amount: number, currency: string) {
    return formatAmount(amount, currency, 2);
}

export default function CompanyWalletPage() {
    const ability = useAbility();
    const canRead = ability.can("read", "Wallet");
    const movements = useWalletMovements(canRead ? "/api/wallets" : null);
    const { data, loading, error, reload } = movements;

    // El chip de la barra superior se actualiza solo (SWR) y anuncia recargas acreditadas.
    // Cuando su saldo cambia, se recargan saldo y movimientos de esta página para que la
    // misma pantalla nunca muestre dos saldos distintos.
    const { data: summary } = useWalletSummary();
    const summaryBalance = summary?.balance;
    const lastSummaryBalance = useRef<number | undefined>(undefined);
    useEffect(() => {
        if (summaryBalance === undefined) return;
        const previous = lastSummaryBalance.current;
        lastSummaryBalance.current = summaryBalance;
        if (previous !== undefined && previous !== summaryBalance) void reload();
    }, [summaryBalance, reload]);

    if (!canRead) {
        return <div className="p-8">No tienes permisos para ver esta página.</div>;
    }

    const presentation = data ? balancePresentation(data.wallet.balance) : null;

    return (
        <div className="mx-auto w-full max-w-[1440px] space-y-6 p-4 sm:p-6 lg:p-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-balance">Mi cuenta</h1>
                <p className="mt-2 text-sm text-muted-foreground">Consulta el saldo, los estados emitidos y cada movimiento confirmado.</p>
            </div>

            <Card className="overflow-hidden shadow-none">
                <CardHeader>
                    <CardTitle>{presentation ? presentation.label : "Saldo de la cuenta"}</CardTitle>
                    <CardDescription>{presentation ? presentation.description : "Resumen financiero de tu cuenta comercial."}</CardDescription>
                </CardHeader>
                <CardContent>
                    {data && presentation ? (
                        <div
                            className={`flex flex-wrap items-baseline gap-x-2 text-4xl font-bold tabular-nums transition-opacity duration-200 ${BALANCE_TONE_CLASS[presentation.tone]} ${loading ? "opacity-60" : ""}`}
                            aria-busy={loading}
                        >
                            {formatMoney(presentation.amount, data.wallet.currency)}
                            <span className="text-sm font-medium tracking-wide text-muted-foreground" translate="no">
                                {data.wallet.currency}
                            </span>
                        </div>
                    ) : loading ? (
                        <div role="status" aria-live="polite">
                            <span className="sr-only">Cargando saldo…</span>
                            <Skeleton className="h-10 w-56" />
                        </div>
                    ) : error ? (
                        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                            No pudimos cargar tu saldo.
                            <Button variant="outline" size="sm" onClick={() => void reload()}>
                                <RefreshCw className="size-4" aria-hidden="true" />
                                Reintentar
                            </Button>
                        </div>
                    ) : (
                        <div className="text-muted-foreground">Esta vista es para usuarios de compañía.</div>
                    )}
                </CardContent>
            </Card>

            {data || loading ? (
                <Card className="shadow-none">
                    <CardHeader>
                        <CardTitle>Movimientos</CardTitle>
                        <CardDescription>Movimientos financieros desde el saldo anterior. Las compras previas a ese saldo ya están incluidas en él y solo aparecen en el historial comercial.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <WalletMovementsTable movements={movements} />
                    </CardContent>
                </Card>
            ) : null}

            {data ? <TopUpHistory /> : null}

            {data ? <AccountStatementsPanel /> : null}
        </div>
    );
}
