"use client";

import { useAbility } from "@/components/auth/ability-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AccountStatementsPanel } from "@/components/account-statements/AccountStatementsPanel";
import { TopUpHistory } from "@/components/wallet/top-up-history";
import { useWalletMovements, WalletMovementsTable } from "@/components/wallet/wallet-movements-table";
import { BALANCE_TONE_CLASS, balancePresentation, formatMoney as formatAmount } from "@/lib/wallet/balance";

function formatMoney(amount: number, currency: string) {
    return formatAmount(amount, currency, 2);
}

export default function CompanyWalletPage() {
    const ability = useAbility();
    const canRead = ability.can("read", "Wallet");
    const movements = useWalletMovements(canRead ? "/api/wallets" : null);
    const { data, loading } = movements;

    if (!canRead) {
        return <div className="p-8">No tienes permisos para ver esta página.</div>;
    }

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
                            className={`flex flex-wrap items-baseline gap-x-2 text-4xl font-bold tabular-nums ${BALANCE_TONE_CLASS[balancePresentation(data.wallet.balance).tone]}`}
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

            {data ? <TopUpHistory /> : null}

            {data ? <AccountStatementsPanel /> : null}

            {data ? (
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
        </div>
    );
}
