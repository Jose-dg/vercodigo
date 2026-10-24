'use client';

import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { brandAccent, formatDenomAmount } from '@/lib/codes/catalog-regions';
import { orderReference } from '@/components/codes/order-format';
import { cn } from '@/lib/utils';
import { money, shortDateTime, type DashboardData } from './dashboard-format';

const CHANNEL = { portal: 'Portal', api: 'API', qr: 'QR' } as const;

const STATUS: Record<string, { label: string; className: string }> = {
    completed: { label: 'Completada', className: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' },
    processing: { label: 'En proceso', className: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300' },
    awaiting_stock: { label: 'Esperando stock', className: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300' },
    action_required: { label: 'Requiere acción', className: 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300' },
    failed: { label: 'Fallida', className: 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300' },
};

export function DashboardRecentOrders({ orders }: { orders: DashboardData['recentOrders'] }) {
    return (
        <section className="space-y-3">
            <div className="flex items-baseline justify-between">
                <h2 className="text-lg font-semibold">Órdenes recientes</h2>
                <Link href="/codes/purchase" className="text-sm text-muted-foreground hover:text-foreground">
                    Ver todas
                </Link>
            </div>
            {orders.length === 0 ? (
                <div className="rounded-2xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground shadow-sm">
                    Todavía no hay órdenes.
                </div>
            ) : (
                <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-sm md:hidden">
                    {orders.map((order) => {
                        const accent = brandAccent(order.brand ?? order.productName);
                        const status = STATUS[order.status] ?? STATUS.processing;
                        const href = order.kind === 'purchase' ? `/codes/purchases/${order.id}` : null;
                        const title = order.denomination
                            ? `${order.productName} · ${formatDenomAmount(order.denomination.amount, order.denomination.currency)}`
                            : order.productName;
                        const content = (
                            <div className="flex min-w-0 items-start gap-3 px-4 py-4">
                                <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold', accent.bg, accent.fg)}>
                                    {(order.brand ?? order.productName).slice(0, 2).toUpperCase()}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate font-medium">{title}</p>
                                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                        {order.recipientEmail ? `Para ${order.recipientEmail} · ` : ''}{shortDateTime(order.date)}
                                    </p>
                                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                                        <Badge variant="outline" className={cn('font-normal', status.className)}>{status.label}</Badge>
                                        <span className="font-semibold tabular-nums">{money(order.amount, order.currency)}</span>
                                    </div>
                                </div>
                            </div>
                        );
                        return <li key={`${order.kind}-${order.id}`}>{href ? <Link href={href}>{content}</Link> : content}</li>;
                    })}
                </ul>
            )}
            <div className="hidden overflow-x-auto rounded-2xl border bg-card shadow-sm md:block">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Orden</TableHead>
                            <TableHead className="hidden sm:table-cell">#</TableHead>
                            <TableHead className="hidden md:table-cell">Fecha</TableHead>
                            <TableHead className="hidden lg:table-cell">Canal</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="text-right">Monto</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {orders.map((order) => {
                                const accent = brandAccent(order.brand ?? order.productName);
                                const status = STATUS[order.status] ?? STATUS.processing;
                                const href = order.kind === 'purchase' ? `/codes/purchases/${order.id}` : null;
                                const title = order.denomination
                                    ? `${order.productName} · ${formatDenomAmount(order.denomination.amount, order.denomination.currency)}`
                                    : order.productName;
                                return (
                                    <TableRow key={`${order.kind}-${order.id}`}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold', accent.bg, accent.fg)}>
                                                    {(order.brand ?? order.productName).slice(0, 2).toUpperCase()}
                                                </span>
                                                <div className="min-w-0">
                                                    {href ? (
                                                        <Link href={href} className="block truncate font-medium hover:underline">{title}</Link>
                                                    ) : (
                                                        <span className="block truncate font-medium">{title}</span>
                                                    )}
                                                    {order.recipientEmail && (
                                                        <span className="block truncate text-xs text-muted-foreground">Para {order.recipientEmail}</span>
                                                    )}
                                                    <span className="text-xs text-muted-foreground md:hidden">{shortDateTime(order.date)}</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="hidden font-mono text-sm text-muted-foreground sm:table-cell">
                                            {orderReference(order.id)}
                                        </TableCell>
                                        <TableCell className="hidden whitespace-nowrap text-sm text-muted-foreground md:table-cell">
                                            {shortDateTime(order.date)}
                                        </TableCell>
                                        <TableCell className="hidden lg:table-cell">
                                            <Badge variant="secondary" className="font-normal">{CHANNEL[order.channel]}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={cn('font-normal', status.className)}>{status.label}</Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-semibold tabular-nums">
                                            {money(order.amount, order.currency)}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                    </TableBody>
                </Table>
            </div>
        </section>
    );
}
