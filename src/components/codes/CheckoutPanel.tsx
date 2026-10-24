'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertCircle,
    ArrowRight,
    Building2,
    Gift,
    Loader2,
    Minus,
    Plus,
    RefreshCw,
    Search,
    ShieldCheck,
    Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { normalizeDeliveryRecipient } from '@/lib/codes/delivery-recipient';
import {
    DeliveryRecipientFields,
    type DeliveryRecipientDraft,
    type RecipientMode,
} from '@/components/codes/DeliveryRecipientFields';
import type { RecipientsCsv } from '@/components/codes/RecipientsCsvInput';
import type { BatchPurchasePayload } from '@/components/codes/recipients-batch';
import {
    BuyRegion,
    CatalogProduct,
    REGION_META,
    denominationStock,
    formatDenomAmount,
    maxPurchasableQuantity,
    productStock,
} from '@/lib/codes/catalog-regions';
import { formatMoney } from './order-format';

export interface PriceRow {
    productId: string;
    denominationId: string | null;
    salePrice: number | null;
    currency: string | null;
    rateCopPerUsd?: number | null;
    effectiveRateCopPerUsd?: number | null;
    nominalAmount?: number | null;
}

/** idle: plataforma sin empresa elegida; loading/error: la cotización aún no se puede mostrar. */
export type PricesStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface OriginPhone {
    id: string;
    phone: string;
    label: string;
}

export interface WalletBalance {
    amount: number;
    currency: string;
}

interface CheckoutRow {
    id: string | null;
    label: string;
    stock: number | null;
    price: PriceRow | undefined;
}

/** Eases the displayed number towards `value` so totals don't jump. */
function prefersReducedMotion(): boolean {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function useAnimatedNumber(value: number, durationMs = 350): number {
    const [display, setDisplay] = useState(value);
    const fromRef = useRef(value);
    const reduced = prefersReducedMotion();
    useEffect(() => {
        const from = fromRef.current;
        if (from === value) return;
        // Movimiento reducido: el total se muestra directo (ver el return), sin interpolar.
        if (prefersReducedMotion()) {
            fromRef.current = value;
            return;
        }
        const start = performance.now();
        let frame = 0;
        const tick = (now: number) => {
            const t = Math.min(1, (now - start) / durationMs);
            const eased = 1 - Math.pow(1 - t, 3);
            const next = from + (value - from) * eased;
            fromRef.current = next;
            setDisplay(next);
            if (t < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [value, durationMs]);
    return reduced ? value : display;
}

function SummaryRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-center gap-3 border-b py-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                {icon}
            </span>
            <span className="flex-1 text-sm text-muted-foreground">{label}</span>
            <span className="text-right text-sm font-medium tabular-nums">{value}</span>
        </div>
    );
}

export function CheckoutPanel({
    product,
    region,
    prices,
    pricesStatus,
    onRetryPrices,
    balance,
    isPlatform,
    companies,
    storesForSelectedCompany,
    targetCompanyId,
    targetStoreId,
    onTargetCompanyChange,
    onTargetStoreChange,
    targetOriginPhoneId,
    originPhones,
    onTargetOriginPhoneChange,
    isPurchasing,
    onPurchase,
    onPurchaseBatch,
}: {
    product: CatalogProduct;
    region: BuyRegion | null;
    prices: PriceRow[];
    pricesStatus: PricesStatus;
    onRetryPrices: () => void;
    balance: WalletBalance | null;
    isPlatform: boolean;
    companies: { companyId: string; companyName: string }[];
    storesForSelectedCompany: { id: string; name: string; companyId: string }[];
    targetCompanyId: string;
    targetStoreId: string;
    onTargetCompanyChange: (companyId: string) => void;
    onTargetStoreChange: (storeId: string) => void;
    targetOriginPhoneId: string;
    originPhones: OriginPhone[];
    onTargetOriginPhoneChange: (phoneId: string) => void;
    isPurchasing: boolean;
    onPurchase: (payload: {
        productId: string;
        denominationId: string | null;
        count: number;
        quotedUnitAmount: number;
        quotedCurrency: string;
        quotedRate?: number | null;
        recipient?: { firstName: string; lastName: string; email: string };
    }) => void;
    /** "Varios (CSV)": one purchase per row, each emailed to its person. */
    onPurchaseBatch: (payload: BatchPurchasePayload) => void;
}) {
    const rows = useMemo<CheckoutRow[]>(() => {
        const priceFor = (denominationId: string | null) =>
            prices.find((p) => p.productId === product.id && p.denominationId === denominationId);
        if (product.denominations.length === 0) {
            return [{ id: null, label: product.name, stock: productStock(product), price: priceFor(null) }];
        }
        return [...product.denominations]
            .sort((a, b) => a.amount - b.amount)
            .map((d) => ({
                id: d.id,
                label: formatDenomAmount(d.amount, d.currency),
                stock: denominationStock(d),
                price: priceFor(d.id),
            }));
    }, [product, prices]);

    const [selectedId, setSelectedId] = useState<string | null>(rows[0]?.id ?? null);
    const [query, setQuery] = useState('');
    const [quantity, setQuantity] = useState(1);
    // Texto del input mientras se escribe: borrar para teclear otra cantidad no debe saltar a 1.
    const [quantityDraft, setQuantityDraft] = useState<string | null>(null);
    const pricesLoading = pricesStatus === 'loading';
    const [sendToCustomer, setSendToCustomer] = useState(false);
    const [recipientDraft, setRecipientDraft] = useState<DeliveryRecipientDraft>({ firstName: '', lastName: '', email: '' });
    const [recipientConsent, setRecipientConsent] = useState(false);
    const [recipientMode, setRecipientMode] = useState<RecipientMode>('single');
    const [recipientsCsv, setRecipientsCsv] = useState<RecipientsCsv | null>(null);
    const csvMode = sendToCustomer && recipientMode === 'csv';
    // A file with errors buys nothing: the count stays 0 until it is fixed.
    const csvCount = recipientsCsv && recipientsCsv.parsed.errors.length === 0 ? recipientsCsv.parsed.rows.length : 0;
    const recipientCheck = useMemo(() => {
        if (!sendToCustomer) return { recipient: undefined, error: null };
        try {
            return { recipient: normalizeDeliveryRecipient(recipientDraft), error: null };
        } catch (error) {
            return { recipient: undefined, error: error instanceof Error ? error.message : 'Destinatario inválido' };
        }
    }, [sendToCustomer, recipientDraft]);

    const selected = rows.find((row) => row.id === selectedId) ?? rows[0];
    const filtered = query.trim()
        ? rows.filter((row) => row.label.toLowerCase().includes(query.trim().toLowerCase()))
        : rows;

    const maxQuantity = Math.max(maxPurchasableQuantity(selected?.stock ?? null), 1);
    const outOfStock = selected?.stock != null && selected.stock <= 0;
    // With a CSV every row is one code for one person.
    const count = csvMode ? csvCount : quantity;
    const exceedsStock = selected?.stock != null && !outOfStock && count > selected.stock;
    const unitPrice = selected?.price?.salePrice ?? null;
    const priceCurrency = selected?.price?.currency ?? balance?.currency ?? 'USD';
    const total = unitPrice != null ? unitPrice * count : null;
    const animatedTotal = useAnimatedNumber(total ?? 0);
    const insufficientBalance =
        total != null && balance != null && balance.currency === priceCurrency && total > balance.amount;
    const hasOrigin = Boolean(targetStoreId || targetOriginPhoneId);
    const canConfirm =
        Boolean(selected)
        && unitPrice != null
        && (!isPlatform || (Boolean(targetCompanyId) && hasOrigin))
        && (csvMode
            ? csvCount > 0 && recipientConsent
            : quantity >= 1
                && quantity <= maxQuantity
                && (!sendToCustomer || (Boolean(recipientCheck.recipient) && recipientConsent)));
    // Origin is exclusive: a store or a phone number, encoded as "kind:id".
    const originValue = targetOriginPhoneId
        ? `phone:${targetOriginPhoneId}`
        : targetStoreId
            ? `store:${targetStoreId}`
            : undefined;

    function selectOrigin(value: string) {
        const [kind, id] = [value.slice(0, value.indexOf(':')), value.slice(value.indexOf(':') + 1)];
        onTargetStoreChange(kind === 'store' ? id : '');
        onTargetOriginPhoneChange(kind === 'phone' ? id : '');
    }

    function setClampedQuantity(next: number) {
        setQuantity(Math.min(maxQuantity, Math.max(1, next)));
        setQuantityDraft(null);
    }

    function selectRow(id: string | null) {
        setSelectedId(id);
        setQuantity(1);
        setQuantityDraft(null);
    }

    // Una sola columna: con una denominación (la mayoría de productos) no hay nada que
    // elegir y la denominación queda en el resumen; con varias, se eligen arriba.
    const hasChoices = rows.length > 1;

    return (
        <section className="mx-auto flex w-full min-w-0 max-w-xl flex-col rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
            {hasChoices && (
                <div className="mb-5">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Valor</p>
                    {rows.length > 6 && (
                        <div className="relative mb-3">
                            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                name="denomination-search"
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Buscar valor…"
                                className="h-11 pl-9"
                                autoComplete="off"
                            />
                        </div>
                    )}
                    {filtered.length === 0 ? (
                        <p className="py-4 text-center text-sm text-muted-foreground">Sin resultados</p>
                    ) : (
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="listbox" aria-label="Valor">
                            {filtered.map((row) => {
                                const active = row.id === selected?.id;
                                const empty = row.stock != null && row.stock <= 0;
                                return (
                                    <button
                                        key={row.id ?? 'single'}
                                        type="button"
                                        role="option"
                                        aria-selected={active}
                                        onClick={() => selectRow(row.id)}
                                        className={cn(
                                            'flex flex-col items-start gap-0.5 rounded-xl border-2 px-3 py-2.5 text-left transition-colors',
                                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                            active ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 hover:bg-muted/40',
                                        )}
                                    >
                                        <span className="font-semibold">{row.label}</span>
                                        <span className={cn('font-mono text-xs tabular-nums', active ? 'text-primary' : 'text-muted-foreground')}>
                                            {row.price?.salePrice != null
                                                ? formatMoney(row.price.salePrice, row.price.currency ?? priceCurrency)
                                                : pricesLoading
                                                    ? <Skeleton className="h-3 w-14" aria-label="Cargando precio" />
                                                    : '—'}
                                        </span>
                                        {empty && <span className="text-[11px] text-amber-700 dark:text-amber-400">Sin stock · en espera</span>}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {region && (
                <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
                    {REGION_META[region].flag} Región {REGION_META[region].label}: {REGION_META[region].description.toLowerCase()}.
                    Los códigos quedan guardados en tus solicitudes.
                </p>
            )}

            {isPlatform && (
                <div className="mb-5 grid gap-3 rounded-xl border border-amber-300/60 bg-amber-50/60 p-4 dark:border-amber-500/30 dark:bg-amber-500/10 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="target-company" className="flex items-center gap-1.5 text-xs">
                            <Building2 className="size-3.5" /> Empresa que paga
                        </Label>
                        <Select
                            value={targetCompanyId || undefined}
                            onValueChange={(value) => {
                                onTargetCompanyChange(value);
                                onTargetStoreChange('');
                                onTargetOriginPhoneChange('');
                            }}
                        >
                            <SelectTrigger id="target-company" className="h-11 bg-background">
                                <SelectValue placeholder="Seleccionar empresa…" />
                            </SelectTrigger>
                            <SelectContent position="popper" className="z-[100]">
                                {companies.map((company) => (
                                    <SelectItem key={company.companyId} value={company.companyId}>
                                        {company.companyName}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="target-origin" className="text-xs">
                            Origen <span className="font-normal text-muted-foreground">(sede o número)</span>
                        </Label>
                        <Select value={originValue} onValueChange={selectOrigin} disabled={!targetCompanyId}>
                            <SelectTrigger id="target-origin" className="h-11 bg-background">
                                <SelectValue placeholder="Seleccionar origen…" />
                            </SelectTrigger>
                            <SelectContent position="popper" className="z-[100]">
                                {storesForSelectedCompany.length > 0 && (
                                    <SelectGroup>
                                        <SelectLabel>Sedes</SelectLabel>
                                        {storesForSelectedCompany.map((store) => (
                                            <SelectItem key={store.id} value={`store:${store.id}`}>
                                                {store.name}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                )}
                                {originPhones.length > 0 && (
                                    <SelectGroup>
                                        <SelectLabel>Números</SelectLabel>
                                        {originPhones.map((phone) => (
                                            <SelectItem key={phone.id} value={`phone:${phone.id}`}>
                                                {phone.label} · {phone.phone}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                )}
                                {storesForSelectedCompany.length === 0 && originPhones.length === 0 && (
                                    <p className="px-2 py-1.5 text-sm text-muted-foreground">
                                        La empresa no tiene sedes ni números de origen.
                                    </p>
                                )}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            )}

            <fieldset disabled={csvMode} className={cn(csvMode && 'opacity-50')}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Cantidad{csvMode ? ' · con CSV es un código por persona' : ''}
            </p>
            <div className="mb-2 grid gap-3 sm:grid-cols-[1.1fr_1fr]">
                <div className="flex h-14 items-stretch overflow-hidden rounded-xl border focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                    <button
                        type="button"
                        className="flex w-14 items-center justify-center border-r text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
                        onClick={() => setClampedQuantity(quantity - 1)}
                        disabled={quantity <= 1}
                        aria-label="Disminuir cantidad"
                    >
                        <Minus className="size-5" />
                    </button>
                    <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={maxQuantity}
                        name="quantity"
                        autoComplete="off"
                        value={quantityDraft ?? quantity}
                        onChange={(event) => {
                            const raw = event.target.value;
                            const next = parseInt(raw, 10);
                            if (raw === '' || Number.isNaN(next)) {
                                setQuantityDraft(raw);
                                return;
                            }
                            setQuantityDraft(null);
                            setQuantity(Math.min(maxQuantity, Math.max(1, next)));
                        }}
                        onBlur={() => {
                            if (quantityDraft !== null) setClampedQuantity(quantity);
                        }}
                        className="w-full min-w-0 bg-transparent text-center font-mono text-xl font-semibold tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                        aria-label="Cantidad"
                    />
                    <button
                        type="button"
                        className="flex w-14 items-center justify-center border-l text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
                        onClick={() => setClampedQuantity(quantity + 1)}
                        disabled={quantity >= maxQuantity}
                        aria-label="Aumentar cantidad"
                    >
                        <Plus className="size-5" />
                    </button>
                </div>
                <div className="flex h-14 items-center justify-between rounded-xl border px-4 text-sm">
                    <span className="text-muted-foreground">En stock</span>
                    <span className={cn('font-mono font-semibold tabular-nums', outOfStock && 'text-amber-700 dark:text-amber-400')}>
                        {selected?.stock == null ? '—' : selected.stock}
                    </span>
                </div>
            </div>
            </fieldset>
            {outOfStock && (
                <p className="mb-2 text-sm text-amber-800 dark:text-amber-300">
                    Sin stock ahora: el pedido queda en espera hasta que Diem reponga códigos y lo asigne.
                </p>
            )}
            {exceedsStock && (
                <p className="mb-2 text-sm text-amber-800 dark:text-amber-300">
                    Solo hay {selected?.stock} código(s) ahora. El resto queda en espera.
                </p>
            )}

            <div className="mt-3">
                <SummaryRow icon={<Gift className="size-4" />} label="Denominación" value={selected?.label ?? '—'} />
                {selected?.price?.effectiveRateCopPerUsd != null && (
                    <SummaryRow
                        icon={<Wallet className="size-4" />}
                        label="Tasa aplicada"
                        value={<span className="font-mono">{formatMoney(selected.price.effectiveRateCopPerUsd, 'COP')} / USD</span>}
                    />
                )}
                <SummaryRow
                    icon={<Gift className="size-4" />}
                    label="Por unidad"
                    value={
                        unitPrice != null
                            ? <span className="font-mono">{formatMoney(unitPrice, priceCurrency)}</span>
                            : pricesLoading
                                ? <Skeleton className="ml-auto h-4 w-20" aria-label="Cargando precio" />
                                : <span className="font-mono">Sin precio</span>
                    }
                />
                {balance && (
                    <SummaryRow
                        icon={<Wallet className="size-4" />}
                        label="Saldo"
                        value={<span className="font-mono">{formatMoney(balance.amount, balance.currency)}</span>}
                    />
                )}
            </div>

            {selected && unitPrice == null && pricesStatus === 'ready' && (
                <p className="mt-3 flex items-start gap-2 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    Este producto no tiene costo configurado para la empresa. Pide a plataforma que lo configure en Costos.
                </p>
            )}
            {pricesStatus === 'idle' && isPlatform && (
                <p className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
                    <Building2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    Elige la empresa que paga para ver su precio.
                </p>
            )}
            {pricesStatus === 'error' && (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                    <span className="flex items-start gap-2">
                        <AlertCircle className="mt-0.5 size-4 shrink-0" />
                        No pudimos cargar los precios.
                    </span>
                    <Button type="button" variant="outline" size="sm" onClick={onRetryPrices}>
                        <RefreshCw className="size-4" aria-hidden="true" />
                        Reintentar
                    </Button>
                </div>
            )}
            {insufficientBalance && (
                <p className="mt-3 flex items-start gap-2 text-sm text-amber-800 dark:text-amber-300">
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    El total supera el saldo actual. La wallet se debita al completar la entrega.
                </p>
            )}

            <DeliveryRecipientFields
                enabled={sendToCustomer}
                onEnabledChange={setSendToCustomer}
                draft={recipientDraft}
                onDraftChange={setRecipientDraft}
                consent={recipientConsent}
                onConsentChange={setRecipientConsent}
                error={recipientCheck.error}
                mode={recipientMode}
                onModeChange={setRecipientMode}
                csv={recipientsCsv}
                onCsvChange={setRecipientsCsv}
            />

            <div className="sticky bottom-0 z-10 -mx-4 mt-auto bg-card/95 px-4 pb-[calc(0.25rem+env(safe-area-inset-bottom))] pt-4 backdrop-blur supports-[backdrop-filter]:bg-card/90 sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-5 sm:backdrop-blur-none">
                <div className="flex items-end justify-between border-t border-dashed pt-5">
                    <span className="text-sm text-muted-foreground">A pagar</span>
                    <span className="font-mono text-3xl font-semibold tabular-nums text-primary sm:text-4xl">
                        {total != null
                            ? formatMoney(animatedTotal, priceCurrency)
                            : pricesLoading
                                ? <Skeleton className="h-9 w-36 sm:h-10" aria-label="Calculando total" />
                                : '—'}
                    </span>
                </div>
                <Button
                    className="mt-5 h-14 w-full rounded-xl text-base font-semibold transition-transform active:scale-[0.98]"
                    size="lg"
                    disabled={isPurchasing || !canConfirm}
                    onClick={() => {
                        if (!selected || unitPrice == null) return;
                        const quote = {
                            productId: product.id,
                            denominationId: selected.id,
                            quotedUnitAmount: unitPrice,
                            quotedCurrency: priceCurrency,
                            quotedRate: selected.price?.rateCopPerUsd,
                        };
                        if (csvMode && recipientsCsv) {
                            onPurchaseBatch({ ...quote, fileText: recipientsCsv.text, rows: recipientsCsv.parsed.rows });
                            return;
                        }
                        onPurchase({ ...quote, count: quantity, recipient: recipientCheck.recipient });
                    }}
                >
                    {isPurchasing ? (
                        <>
                            <Loader2 className="mr-2 size-5 animate-spin" />
                            Procesando…
                        </>
                    ) : (
                        <>
                            {pricesLoading
                                ? 'Cargando precio…'
                                : csvMode
                                    ? `Enviar a ${csvCount} destinatario(s)`
                                    : outOfStock
                                    ? 'Pedir (queda en espera de stock)'
                                    : 'Realizar la orden'}
                            <ArrowRight className="ml-2 size-5" />
                        </>
                    )}
                </Button>
                <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                    <ShieldCheck className="size-3.5" />
                    Entrega protegida: la wallet se debita solo cuando la entrega se completa.
                </p>
            </div>
        </section>
    );
}
