'use client';

import type { ReactNode } from 'react';
import { Package, Wallet, Zap, CreditCard } from 'lucide-react';

import { BALANCE_TONE_CLASS, balancePresentation } from '@/lib/wallet/balance';
import { cn } from '@/lib/utils';
import { money, type DashboardData } from './dashboard-format';

function KpiCard({
    label,
    value,
    hint,
    icon,
    valueClassName,
}: {
    label: string;
    value: string;
    hint: string;
    icon: ReactNode;
    valueClassName?: string;
}) {
    return (
        <div className="min-w-0 rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
            <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
                    {icon}
                </span>
            </div>
            <p className={cn('mt-3 break-words text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl', valueClassName)}>{value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
        </div>
    );
}

export function DashboardKpis({ data }: { data: DashboardData }) {
    const balance = balancePresentation(data.kpis.balance);
    return (
        <div className="grid gap-3 min-[440px]:grid-cols-2 sm:gap-4 xl:grid-cols-4">
            <KpiCard
                label={balance.shortLabel}
                value={money(balance.amount, data.currency)}
                hint={data.kpis.balance >= 0 ? 'disponible para órdenes' : balance.description}
                icon={<Wallet aria-hidden="true" className="size-4" />}
                valueClassName={data.kpis.balance >= 0 ? 'text-violet-600 dark:text-violet-400' : BALANCE_TONE_CLASS[balance.tone]}
            />
            <KpiCard
                label="Órdenes"
                value={data.kpis.orders.toLocaleString('es-CO')}
                hint={`${data.kpis.completedOrders.toLocaleString('es-CO')} completadas`}
                icon={<Package aria-hidden="true" className="size-4" />}
            />
            <KpiCard
                label="Total gastado"
                value={money(data.kpis.totalSpent, data.currency)}
                hint="todo el tiempo"
                icon={<Zap aria-hidden="true" className="size-4" />}
            />
            <KpiCard
                label="Depositado"
                value={money(data.kpis.deposited, data.currency)}
                hint="todo el tiempo"
                icon={<CreditCard aria-hidden="true" className="size-4" />}
            />
        </div>
    );
}
