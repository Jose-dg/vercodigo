'use client';

import type { ReactNode } from 'react';
import {
    ArrowDownLeft,
    ArrowUpRight,
    Box,
    Calculator,
    Check,
    Clock,
    Copy,
    Gift,
    Hash,
    KeyRound,
    Layers,
    Loader2,
    RefreshCw,
    Tag,
    Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { brandAccent, formatDenomAmount } from '@/lib/codes/catalog-regions';
import type { PurchaseTimeline } from '@/lib/codes/purchase-timeline';
import { OrderProgress } from './OrderProgress';
import { StatusHistory } from './StatusHistory';
import { TONE_STYLES, formatMoney, formatShortWhen, orderReference } from './order-format';

export interface PurchaseWalletTransaction {
    id: string;
    type: string;
    status: string;
    amount: number;
    balanceAfter: number | null;
    description: string | null;
    createdAt: string;
    currency: string;
}

export interface PurchaseDetail {
    kind?: 'purchase' | 'activation';
    id: string;
    cardUuid?: string | null;
    count: number;
    totalAmount: number;
    currency: string;
    status: string;
    fulfillmentStatus?: string | null;
    lastError?: string | null;
    createdAt: string;
    completedAt?: string | null;
    productName?: string;
    productBrand: string | null;
    productCategory: string | null;
    requesterLabel?: string;
    isPending: boolean;
    isSuccessful: boolean;
    needsAction: boolean;
    keys: { code: string }[];
    deliveredCodeCount: number;
    hasDeliveryCountMismatch: boolean;
    denomination?: { amount: number; currency: string } | null;
    unitPrice: number;
    timeline: PurchaseTimeline;
    walletTransactions: PurchaseWalletTransaction[];
}

function Section({ icon, title, children, className }: {
    icon: ReactNode;
    title: string;
    children: ReactNode;
    className?: string;
}) {
    return (
        <section className={cn('rounded-2xl border bg-card p-5 shadow-sm sm:p-6', className)}>
            <h2 className="mb-4 flex items-center gap-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {icon}
                {title}
            </h2>
            {children}
        </section>
    );
}

function DetailRow({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
    return (
        <div className="flex items-center gap-3 border-b py-3 last:border-b-0">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                {icon}
            </span>
            <span className="flex-1 text-sm text-muted-foreground">{label}</span>
            <span className="text-right text-sm font-medium">{value}</span>
        </div>
    );
}

function walletMovementLabel(type: string): string {
    if (type === 'CONSUMPTION') return 'Pago de la orden';
    if (type === 'REFUND') return 'Reembolso';
    if (type === 'ADJUSTMENT') return 'Ajuste';
    return type;
}

export function OrderDetail({
    purchase,
    autoRefreshing,
    retrying,
    onRetry,
}: {
    purchase: PurchaseDetail;
    autoRefreshing: boolean;
    retrying: boolean;
    onRetry: () => void;
}) {
    const { timeline } = purchase;
    const tone = TONE_STYLES[timeline.tone];
    const accent = brandAccent(purchase.productBrand ?? purchase.productName ?? '');
    const title = purchase.denomination
        ? formatDenomAmount(purchase.denomination.amount, purchase.denomination.currency)
        : (purchase.productName ?? 'Producto');
    const charged = purchase.walletTransactions.length > 0;
    const showRetry = purchase.needsAction || (purchase.isPending && Boolean(purchase.lastError));

    const copyCodes = () => {
        navigator.clipboard.writeText(purchase.keys.map((row) => row.code).join('\n'));
        toast.success('Códigos copiados');
    };

    return (
        <div className="space-y-5 animate-in fade-in-0 slide-in-from-bottom-4 duration-300">
            <section className={cn('rounded-2xl border border-l-4 bg-card p-5 shadow-sm sm:p-7', tone.border)}>
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-3">
                        <div className="flex items-center gap-4">
                            <span
                                className={cn(
                                    'flex size-14 shrink-0 items-center justify-center rounded-2xl shadow-inner',
                                    accent.bg,
                                    accent.fg,
                                )}
                            >
                                <Gift className="size-6" />
                            </span>
                            <div className="min-w-0">
                                <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
                                <p className="truncate text-sm text-muted-foreground">{purchase.productName}</p>
                            </div>
                        </div>
                        <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
                            <span className={cn('font-medium', tone.text)}>{timeline.statusLabel}</span>
                            <span>·</span>
                            <span className="font-mono">
                                {purchase.kind === 'activation' && purchase.cardUuid
                                    ? `Activación QR ${purchase.cardUuid}`
                                    : orderReference(purchase.id)}
                            </span>
                            <span>·</span>
                            <span className="tabular-nums">{formatShortWhen(purchase.createdAt)}</span>
                            {purchase.requesterLabel && (
                                <>
                                    <span>·</span>
                                    <span>{purchase.requesterLabel}</span>
                                </>
                            )}
                        </p>
                        {(purchase.productCategory || purchase.productBrand) && (
                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                                <Tag className="size-3.5" />
                                {purchase.productCategory ?? purchase.productBrand}
                            </span>
                        )}
                    </div>
                    <div className="shrink-0 border-t pt-4 sm:border-l sm:border-t-0 sm:pl-8 sm:pt-0 sm:text-right">
                        <p className="text-sm text-muted-foreground">{charged ? 'Cobrado' : 'Por cobrar'}</p>
                        <p className="font-mono text-3xl font-semibold tabular-nums text-primary sm:text-4xl">
                            {formatMoney(purchase.totalAmount, purchase.currency)}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">Pedido: ×{purchase.count}</p>
                    </div>
                </div>

                <div className="mt-6 border-t pt-5">
                    <p className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                        {autoRefreshing ? (
                            <>
                                <span className={cn('size-2 animate-pulse rounded-full', tone.dot)} />
                                Actualizando automáticamente
                            </>
                        ) : (
                            <>
                                <span className={cn('size-2 rounded-full', tone.dot)} />
                                {timeline.isTerminal ? 'Orden finalizada' : 'Seguimiento en pausa'}
                            </>
                        )}
                    </p>
                    <OrderProgress timeline={timeline} />
                </div>

                {(purchase.lastError || showRetry) && !purchase.isSuccessful && (
                    <div className="mt-5 flex flex-col gap-3 rounded-xl border border-amber-300/60 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200 sm:flex-row sm:items-center sm:justify-between">
                        <p>{purchase.lastError ?? 'La orden necesita revisión. La wallet no se ha debitado.'}</p>
                        {showRetry && (
                            <Button variant="outline" size="sm" className="shrink-0" disabled={retrying} onClick={onRetry}>
                                {retrying ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : <RefreshCw className="mr-2 size-3.5" />}
                                {purchase.needsAction ? 'Reintentar Diem' : 'Consultar Diem'}
                            </Button>
                        )}
                    </div>
                )}
            </section>

            <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
                <div className="space-y-5">
                    <Section icon={<Box className="size-4" />} title="Qué se pidió">
                        <DetailRow icon={<Hash className="size-4" />} label="Denominación" value={title} />
                        <DetailRow
                            icon={<Layers className="size-4" />}
                            label="Producto"
                            value={`${purchase.productName ?? 'Producto'} · ×${purchase.count}`}
                        />
                        <DetailRow
                            icon={<Hash className="size-4" />}
                            label="Cantidad"
                            value={<span className="tabular-nums">{purchase.count}</span>}
                        />
                    </Section>

                    {purchase.isSuccessful && (
                        <Section icon={<KeyRound className="size-4" />} title="Códigos entregados">
                            {purchase.keys.length ? (
                                <>
                                    <ol className="max-h-72 divide-y divide-dashed overflow-y-auto rounded-xl border bg-muted/40 px-4 font-mono text-sm">
                                        {purchase.keys.map((row, index) => (
                                            <li key={`${row.code}-${index}`} className="flex items-center gap-4 py-3">
                                                <span className="w-6 text-muted-foreground">{index + 1}.</span>
                                                <span className="select-all break-all font-semibold">{row.code}</span>
                                            </li>
                                        ))}
                                    </ol>
                                    {purchase.hasDeliveryCountMismatch && (
                                        <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">
                                            {purchase.count} unidad(es) facturada(s) · {purchase.deliveredCodeCount} códigos registrados
                                        </p>
                                    )}
                                    <Button variant="outline" className="mt-4 h-11" onClick={copyCodes}>
                                        <Copy className="mr-2 size-4" />
                                        Copiar códigos
                                    </Button>
                                </>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    No hay códigos registrados para esta entrega. Contacta soporte.
                                </p>
                            )}
                        </Section>
                    )}

                    <Section icon={<Clock className="size-4" />} title="Historial de estados">
                        <StatusHistory timeline={timeline} />
                    </Section>
                </div>

                <div className="space-y-5">
                    <Section icon={<Calculator className="size-4" />} title="Cálculo">
                        <DetailRow
                            icon={<Gift className="size-4" />}
                            label="Por unidad"
                            value={<span className="font-mono tabular-nums">{formatMoney(purchase.unitPrice, purchase.currency)}</span>}
                        />
                        <DetailRow
                            icon={<Layers className="size-4" />}
                            label="Pedido"
                            value={<span className="tabular-nums">×{purchase.count}</span>}
                        />
                        <div className="mt-2 flex items-center justify-between border-t border-dashed pt-4">
                            <span className="text-sm text-muted-foreground">{charged ? 'Cobrado' : 'Total a cobrar'}</span>
                            <span className="font-mono text-lg font-semibold tabular-nums text-primary">
                                {formatMoney(purchase.totalAmount, purchase.currency)}
                            </span>
                        </div>
                    </Section>

                    <Section icon={<Wallet className="size-4" />} title="Movimientos de wallet">
                        {purchase.walletTransactions.length === 0 ? (
                            <p className="text-sm leading-relaxed text-muted-foreground">
                                {purchase.status === 'FAILED'
                                    ? 'No se debitó la wallet.'
                                    : 'La wallet se debita solo cuando la entrega se completa.'}
                            </p>
                        ) : (
                            <ul className="space-y-3">
                                {purchase.walletTransactions.map((tx) => {
                                    const outgoing = tx.type === 'CONSUMPTION';
                                    return (
                                        <li
                                            key={tx.id}
                                            className={cn(
                                                'flex items-center gap-3 rounded-xl border border-l-4 p-3',
                                                outgoing ? 'border-l-emerald-500' : 'border-l-sky-500',
                                            )}
                                        >
                                            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                                                {outgoing ? <ArrowUpRight className="size-4" /> : <ArrowDownLeft className="size-4" />}
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-medium">{walletMovementLabel(tx.type)}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    <span className={tx.status === 'CONFIRMED' ? 'text-emerald-600 dark:text-emerald-400' : ''}>
                                                        {tx.status === 'CONFIRMED' ? 'Completado' : 'Pendiente'}
                                                    </span>
                                                    {' · '}
                                                    <span className="tabular-nums">{formatShortWhen(tx.createdAt)}</span>
                                                </p>
                                            </div>
                                            <span className="rounded-lg bg-muted px-2.5 py-1 font-mono text-sm font-medium tabular-nums">
                                                {outgoing ? '−' : '+'}{formatMoney(tx.amount, tx.currency)}
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </Section>

                    {purchase.isSuccessful && (
                        <p className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
                            <Check className="size-3.5 text-emerald-500" />
                            Entregada {formatShortWhen(purchase.completedAt ?? null)}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
