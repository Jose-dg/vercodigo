'use client';

import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarDays, Download, Gift, Loader2, QrCode } from 'lucide-react';
import { es } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { bucketLabel, compactMoney, money, type DashboardData } from './dashboard-format';

export type RangeSelection =
    | { range: '7d' | '30d' | 'all' }
    | { range: 'period'; from: string; to: string };

const RANGES: { value: '7d' | '30d' | 'all'; label: string }[] = [
    { value: '7d', label: '7 días' },
    { value: '30d', label: '30 días' },
    { value: 'all', label: 'Todo' },
];

const BAR_COLOR = '#8b5cf6';

const isoDay = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

function ProgressRow({ icon, label, count, amount, max, currency }: {
    icon: React.ReactNode;
    label: string;
    count: number;
    amount: number;
    max: number;
    currency: string;
}) {
    return (
        <li className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
                {icon}
            </span>
            <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate">
                        {label} <span className="text-xs text-muted-foreground">×{count}</span>
                    </span>
                    <span className="font-semibold tabular-nums">{money(amount, currency)}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-violet-500" style={{ width: `${max > 0 ? Math.max(2, (amount / max) * 100) : 0}%` }} />
                </div>
            </div>
        </li>
    );
}

export function DashboardStatistics({
    data,
    selection,
    onSelectionChange,
    loading,
    onExport,
    exporting,
}: {
    data: DashboardData;
    selection: RangeSelection;
    onSelectionChange: (selection: RangeSelection) => void;
    loading: boolean;
    onExport: () => void;
    exporting: boolean;
}) {
    const [periodOpen, setPeriodOpen] = useState(false);
    const [draft, setDraft] = useState<DateRange | undefined>();
    const { stats, currency } = data;
    const chart = stats.series.map((point) => ({ ...point, label: bucketLabel(point.key, stats.bucket) }));
    const serviceMax = Math.max(0, ...stats.byService.map((row) => row.amount));
    const topMax = Math.max(0, ...stats.topProducts.map((row) => row.amount));

    return (
        <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h2 className="flex items-center gap-2 text-lg font-semibold">
                        Estadísticas
                        {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Órdenes <strong className="text-foreground">{stats.orders}</strong> · {stats.completedOrders} completadas ·
                        Gastado <strong className="text-violet-600 dark:text-violet-400">{money(stats.spent, currency)}</strong>
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {RANGES.map((range) => (
                        <Button
                            key={range.value}
                            size="sm"
                            variant={selection.range === range.value ? 'default' : 'outline'}
                            className={cn(selection.range === range.value && 'bg-violet-600 text-white hover:bg-violet-600/90')}
                            onClick={() => onSelectionChange({ range: range.value })}
                        >
                            {range.label}
                        </Button>
                    ))}
                    <Popover open={periodOpen} onOpenChange={setPeriodOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                size="sm"
                                variant={selection.range === 'period' ? 'default' : 'outline'}
                                className={cn(selection.range === 'period' && 'bg-violet-600 text-white hover:bg-violet-600/90')}
                            >
                                <CalendarDays className="mr-1.5 size-4" />
                                {selection.range === 'period' ? `${selection.from} → ${selection.to}` : 'Período'}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                            <Calendar mode="range" numberOfMonths={2} locale={es} selected={draft} onSelect={setDraft} />
                            <div className="flex justify-end gap-2 border-t p-3">
                                <Button size="sm" variant="ghost" onClick={() => setPeriodOpen(false)}>
                                    Cancelar
                                </Button>
                                <Button
                                    size="sm"
                                    disabled={!draft?.from}
                                    onClick={() => {
                                        if (!draft?.from) return;
                                        onSelectionChange({ range: 'period', from: isoDay(draft.from), to: isoDay(draft.to ?? draft.from) });
                                        setPeriodOpen(false);
                                    }}
                                >
                                    Aplicar
                                </Button>
                            </div>
                        </PopoverContent>
                    </Popover>
                    <Button size="sm" variant="outline" onClick={onExport} disabled={exporting}>
                        {exporting ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Download className="mr-1.5 size-4" />}
                        Excel
                    </Button>
                </div>
            </div>

            <div className="mt-6 h-72">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chart} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                        <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                        <XAxis
                            dataKey="label"
                            tickLine={false}
                            axisLine={false}
                            fontSize={12}
                            stroke="hsl(var(--muted-foreground))"
                            interval="preserveStartEnd"
                            minTickGap={24}
                        />
                        <YAxis
                            tickLine={false}
                            axisLine={false}
                            fontSize={12}
                            width={64}
                            stroke="hsl(var(--muted-foreground))"
                            tickFormatter={(value: number) => compactMoney(value, currency)}
                        />
                        <Tooltip
                            cursor={{ fill: 'hsl(var(--muted))' }}
                            contentStyle={{
                                background: 'hsl(var(--popover))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: 10,
                                color: 'hsl(var(--popover-foreground))',
                                fontSize: 13,
                            }}
                            formatter={(value) => [money(Number(value), currency), 'Gastado']}
                            labelFormatter={(label) => String(label)}
                        />
                        <Bar dataKey="amount" fill={BAR_COLOR} radius={[6, 6, 2, 2]} maxBarSize={36} />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <div className="mt-6 grid gap-8 border-t pt-6 lg:grid-cols-2">
                <div>
                    <h3 className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">Por servicio</h3>
                    {stats.byService.length ? (
                        <ul className="space-y-4">
                            {stats.byService.map((row) => (
                                <ProgressRow
                                    key={row.service}
                                    icon={row.service === 'activations' ? <QrCode className="size-4" /> : <Gift className="size-4" />}
                                    label={row.label}
                                    count={row.orders}
                                    amount={row.amount}
                                    max={serviceMax}
                                    currency={currency}
                                />
                            ))}
                        </ul>
                    ) : (
                        <p className="text-sm text-muted-foreground">Sin gastos en este período.</p>
                    )}
                </div>
                <div>
                    <h3 className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">Top 10 por gasto</h3>
                    {stats.topProducts.length ? (
                        <ul className="space-y-4">
                            {stats.topProducts.map((row) => (
                                <ProgressRow
                                    key={`${row.productId}-${row.denomination?.amount ?? ''}`}
                                    icon={<Gift className="size-4" />}
                                    label={`${row.name}${row.region ? ` (${row.region})` : ''}${row.denomination ? ` · ${row.denomination.amount} ${row.denomination.currency}` : ''}`}
                                    count={row.orders}
                                    amount={row.amount}
                                    max={topMax}
                                    currency={currency}
                                />
                            ))}
                        </ul>
                    ) : (
                        <p className="text-sm text-muted-foreground">Sin compras en este período.</p>
                    )}
                </div>
            </div>
        </section>
    );
}
