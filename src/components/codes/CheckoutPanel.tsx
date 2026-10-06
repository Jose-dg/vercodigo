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
    Search,
    ShieldCheck,
    Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
}

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
function useAnimatedNumber(value: number, durationMs = 350): number {
    const [display, setDisplay] = useState(value);
    const fromRef = useRef(value);
    useEffect(() => {
        const from = fromRef.current;
        if (from === value) return;
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
    return display;
}

function SummaryRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-center gap-3 border-b py-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
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
}: {
    product: CatalogProduct;
    region: BuyRegion | null;
    prices: PriceRow[];
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
    onPurchase: (payload: { productId: string; denominationId: string | null; count: number }) => void;
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

    const selected = rows.find((row) => row.id === selectedId) ?? rows[0];
    const filtered = query.trim()
        ? rows.filter((row) => row.label.toLowerCase().includes(query.trim().toLowerCase()))
        : rows;

    const maxQuantity = Math.max(maxPurchasableQuantity(selected?.stock ?? null), 1);
    const outOfStock = selected?.stock != null && selected.stock <= 0;
    const exceedsStock = selected?.stock != null && !outOfStock && quantity > selected.stock;
    const unitPrice = selected?.price?.salePrice ?? null;
    const priceCurrency = selected?.price?.currency ?? balance?.currency ?? 'USD';
    const total = unitPrice != null ? unitPrice * quantity : null;
    const animatedTotal = useAnimatedNumber(total ?? 0);
    const insufficientBalance =
        total != null && balance != null && balance.currency === priceCurrency && total > balance.amount;
    const hasOrigin = Boolean(targetStoreId || targetOriginPhoneId);
    const canConfirm =
        Boolean(selected)
        && quantity >= 1
        && quantity <= maxQuantity
        && (!isPlatform || (Boolean(targetCompanyId) && hasOrigin));
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
    }

    function selectRow(id: string | null) {
        setSelectedId(id);
        setQuantity(1);
    }

    return (
        <div className="grid gap-5 lg:grid-cols-2">
            <section className="flex flex-col rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
                <div className="mb-4 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <span>Denominaciones</span>
                    <span>Precio</span>
                </div>
                {rows.length > 6 && (
                    <div className="relative mb-3">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Buscar denominación"
                            className="h-11 pl-9"
                        />
                    </div>
                )}
                <ul className="-mx-2 max-h-[26rem] space-y-1 overflow-y-auto px-2" role="listbox" aria-label="Denominaciones">
                    {filtered.length === 0 && (
                        <li className="py-6 text-center text-sm text-muted-foreground">Sin resultados</li>
                    )}
                    {filtered.map((row) => {
                        const active = row.id === selected?.id;
                        const empty = row.stock != null && row.stock <= 0;
                        return (
                            <li key={row.id ?? 'single'}>
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={active}
                                    onClick={() => selectRow(row.id)}
                                    className={cn(
                                        'relative flex min-h-14 w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left transition-all',
                                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                        active ? 'bg-primary/10' : 'hover:bg-muted/60',
                                    )}
                                >
                                    <span
                                        className={cn(
                                            'absolute inset-y-2 left-0 w-1 rounded-full bg-primary transition-opacity',
                                            active ? 'opacity-100' : 'opacity-0',
                                        )}
                                        aria-hidden
                                    />
                                    <span className="min-w-0">
                                        <span className="block font-medium">{row.label}</span>
                                        {empty && <span className="text-xs text-amber-700 dark:text-amber-400">Sin stock · queda en espera</span>}
                                    </span>
                                    <span
                                        className={cn(
                                            'shrink-0 rounded-lg px-2.5 py-1 font-mono text-sm tabular-nums transition-colors',
                                            active ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
                                        )}
                                    >
                                        {row.price?.salePrice != null
                                            ? formatMoney(row.price.salePrice, row.price.currency ?? priceCurrency)
                                            : '—'}
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </section>

            <section className="flex flex-col rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
                <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tu orden</h2>

                {region && (
                    <p className="mb-5 rounded-xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
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
                                    <SelectValue placeholder="Seleccionar empresa..." />
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
                                    <SelectValue placeholder="Seleccionar origen..." />
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

                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cantidad</p>
                <div className="mb-2 grid gap-3 sm:grid-cols-[1.1fr_1fr]">
                    <div className="flex h-14 items-stretch overflow-hidden rounded-xl border">
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
                            value={quantity}
                            onChange={(event) => {
                                const next = parseInt(event.target.value, 10);
                                setClampedQuantity(Number.isNaN(next) ? 1 : next);
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
                {outOfStock && (
                    <p className="mb-2 text-sm text-amber-800 dark:text-amber-300">
                        Sin stock ahora: el pedido queda en espera y Diem lo entrega en cuanto haya códigos.
                    </p>
                )}
                {exceedsStock && (
                    <p className="mb-2 text-sm text-amber-800 dark:text-amber-300">
                        Solo hay {selected?.stock} código(s) ahora. El resto queda en espera.
                    </p>
                )}

                <div className="mt-3">
                    <SummaryRow icon={<Gift className="size-4" />} label="Denominación" value={selected?.label ?? '—'} />
                    <SummaryRow
                        icon={<Gift className="size-4" />}
                        label="Por unidad"
                        value={<span className="font-mono">{unitPrice != null ? formatMoney(unitPrice, priceCurrency) : 'Sin precio'}</span>}
                    />
                    {balance && (
                        <SummaryRow
                            icon={<Wallet className="size-4" />}
                            label="Saldo"
                            value={<span className="font-mono">{formatMoney(balance.amount, balance.currency)}</span>}
                        />
                    )}
                </div>

                {insufficientBalance && (
                    <p className="mt-3 flex items-start gap-2 text-sm text-amber-800 dark:text-amber-300">
                        <AlertCircle className="mt-0.5 size-4 shrink-0" />
                        El total supera el saldo actual. La wallet se debita al completar la entrega.
                    </p>
                )}

                <div className="mt-auto pt-5">
                    <div className="flex items-end justify-between border-t border-dashed pt-5">
                        <span className="text-sm text-muted-foreground">A pagar</span>
                        <span className="font-mono text-3xl font-semibold tabular-nums text-primary sm:text-4xl">
                            {total != null ? formatMoney(animatedTotal, priceCurrency) : '—'}
                        </span>
                    </div>
                    <Button
                        className="mt-5 h-14 w-full rounded-xl text-base font-semibold transition-transform active:scale-[0.98]"
                        size="lg"
                        disabled={isPurchasing || !canConfirm}
                        onClick={() =>
                            selected && onPurchase({ productId: product.id, denominationId: selected.id, count: quantity })
                        }
                    >
                        {isPurchasing ? (
                            <>
                                <Loader2 className="mr-2 size-5 animate-spin" />
                                Procesando...
                            </>
                        ) : (
                            <>
                                {outOfStock ? 'Pedir (queda en espera de stock)' : 'Realizar la orden'}
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
        </div>
    );
}
