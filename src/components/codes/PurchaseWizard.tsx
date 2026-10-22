'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { BatchPurchasePayload } from '@/components/codes/recipients-batch';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    BuyRegion,
    CatalogProduct,
    REGION_META,
    brandAccent,
    brandsInRegion,
    distinctiveProductLabels,
    filterProductsByRegion,
    filterProductsByRegionAndBrand,
    productRegions,
    productStock,
    stockLabel,
} from '@/lib/codes/catalog-regions';
import { CheckoutPanel, type OriginPhone, type PriceRow, type PricesStatus, type WalletBalance } from './CheckoutPanel';
import { formatMoney } from './order-format';
import { Skeleton } from '@/components/ui/skeleton';

export type { OriginPhone, PriceRow, PricesStatus, WalletBalance } from './CheckoutPanel';

export type WizardStep = 'region' | 'brand' | 'product' | 'order';

/**
 * Cada paso es una entrada del historial del navegador: el gesto o botón "atrás" del
 * celular vuelve un paso en vez de sacar al usuario de la compra. `depth` cuenta las
 * entradas propias para que "Atrás" dentro de la página nunca salga del wizard.
 */
interface WizardSnapshot {
    step: WizardStep;
    region: BuyRegion | null;
    brand: string | null;
    productId: string;
    depth: number;
}

const INITIAL_SNAPSHOT: WizardSnapshot = { step: 'region', region: null, brand: null, productId: '', depth: 0 };
const HISTORY_KEY = 'purchaseWizard';

/** Una entrada del historial puede apuntar a un producto que ya no está en el catálogo. */
function validSnapshot(candidate: unknown, products: CatalogProduct[]): WizardSnapshot {
    const snapshot = candidate as WizardSnapshot | undefined;
    if (!snapshot || typeof snapshot !== 'object' || !snapshot.region) return INITIAL_SNAPSHOT;
    const snapshotRegion = snapshot.region;
    if (!products.some((product) => productRegions(product).includes(snapshotRegion))) {
        return INITIAL_SNAPSHOT;
    }
    if (snapshot.brand && filterProductsByRegionAndBrand(products, snapshotRegion, snapshot.brand).length === 0) {
        return { ...INITIAL_SNAPSHOT, step: 'brand', region: snapshotRegion, depth: snapshot.depth };
    }
    if (snapshot.step === 'order' && !products.some((product) => product.id === snapshot.productId)) {
        return { ...snapshot, step: 'product', productId: '' };
    }
    return snapshot;
}

export interface PurchaseWizardProps {
    products: CatalogProduct[];
    productsError: string | null;
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
    onPurchaseBatch: (payload: BatchPurchasePayload) => void;
}

const PROGRESS_STEPS: { key: WizardStep; label: string }[] = [
    { key: 'region', label: 'Región' },
    { key: 'brand', label: 'Marca' },
    { key: 'order', label: 'Orden' },
];

function progressIndex(step: WizardStep): number {
    // The optional product step sits between brand and order.
    if (step === 'product') return 1;
    return PROGRESS_STEPS.findIndex((s) => s.key === step);
}

function RegionFlag({ region, className }: { region: BuyRegion; className?: string }) {
    return (
        <span
            className={cn('inline-flex select-none items-center justify-center leading-none', className)}
            aria-hidden
        >
            {REGION_META[region].flag}
        </span>
    );
}

function SelectionTile({
    selected,
    onClick,
    disabled,
    className,
    children,
}: {
    selected?: boolean;
    onClick: () => void;
    disabled?: boolean;
    className?: string;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            aria-pressed={selected}
            className={cn(
                'flex min-h-16 w-full items-center gap-3 rounded-2xl border-2 px-4 py-4 text-left transition-all',
                'active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                selected
                    ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20'
                    : 'border-border bg-background hover:border-primary/40 hover:bg-muted/40',
                className,
            )}
        >
            {children}
        </button>
    );
}

function StepBar({ step }: { step: WizardStep }) {
    const current = progressIndex(step);
    return (
        <ol className="grid grid-cols-3 gap-2" aria-label="Progreso de la compra">
            {PROGRESS_STEPS.map((s, i) => (
                <li key={s.key} className="space-y-1.5">
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                            className={cn(
                                'h-full rounded-full bg-primary transition-[width] duration-500 ease-out',
                                i < current ? 'w-full opacity-50' : i === current ? 'w-full' : 'w-0',
                            )}
                        />
                    </div>
                    <p className={cn('text-xs', i === current ? 'font-medium text-foreground' : 'text-muted-foreground')}>
                        {s.label}
                    </p>
                </li>
            ))}
        </ol>
    );
}

export function PurchaseWizard({
    products,
    productsError,
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
}: PurchaseWizardProps) {
    // El wizard solo se monta en el cliente, con el catálogo ya cargado: se puede leer el
    // historial al inicializar (recarga o regreso desde el detalle de una orden).
    const [wizard, setWizard] = useState<WizardSnapshot>(() =>
        validSnapshot(window.history.state?.[HISTORY_KEY], products),
    );
    const { step, region, brand, productId } = wizard;

    useEffect(() => {
        const onPopState = (event: PopStateEvent) => {
            setWizard(validSnapshot(event.state?.[HISTORY_KEY], products));
        };
        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, [products]);

    function advance(next: Omit<WizardSnapshot, 'depth'>) {
        const snapshot = { ...next, depth: wizard.depth + 1 };
        // Sin __NA propio: Next copia su estado interno y resuelve el "atrás" sin recargar.
        window.history.pushState({ [HISTORY_KEY]: snapshot }, '');
        setWizard(snapshot);
    }

    const availableRegions = useMemo(() => {
        const present = new Set(products.flatMap(productRegions));
        return (Object.keys(REGION_META) as BuyRegion[]).filter((r) => present.has(r));
    }, [products]);

    const brands = useMemo(
        () => (region ? brandsInRegion(products, region) : []),
        [products, region],
    );

    const regionProducts = useMemo(
        () => (region && brand ? filterProductsByRegionAndBrand(products, region, brand) : []),
        [products, region, brand],
    );

    const selectedProduct = regionProducts.find((p) => p.id === productId);
    const productLabels = useMemo(() => distinctiveProductLabels(regionProducts), [regionProducts]);

    /** Precio unitario (o el menor, si el producto tiene varios valores) para la tarjeta. */
    function tilePrice(product: CatalogProduct): { amount: number; currency: string; from: boolean } | null {
        const rows = prices.filter((row) => row.productId === product.id && row.salePrice != null);
        if (rows.length === 0) return null;
        const cheapest = rows.reduce((min, row) => ((row.salePrice ?? 0) < (min.salePrice ?? 0) ? row : min));
        return { amount: cheapest.salePrice ?? 0, currency: cheapest.currency ?? 'COP', from: product.denominations.length > 1 };
    }

    function goBack() {
        if (wizard.depth > 0) {
            window.history.back();
            return;
        }
        // Paso restaurado sin entradas propias detrás: retroceder sin salir de la página.
        if (step === 'order') {
            setWizard({ ...wizard, step: regionProducts.length > 1 ? 'product' : 'brand', productId: '' });
        } else if (step === 'product') {
            setWizard({ ...wizard, step: 'brand', productId: '' });
        } else if (step === 'brand') {
            setWizard(INITIAL_SNAPSHOT);
        }
    }

    function selectRegion(next: BuyRegion) {
        advance({ step: 'brand', region: next, brand: null, productId: '' });
    }

    function selectBrand(next: string) {
        const options = region ? filterProductsByRegionAndBrand(products, region, next) : [];
        if (options.length === 1) {
            advance({ step: 'order', region, brand: next, productId: options[0].id });
            return;
        }
        advance({ step: 'product', region, brand: next, productId: '' });
    }

    function selectProduct(nextId: string) {
        advance({ step: 'order', region, brand, productId: nextId });
    }

    if (step === 'order' && selectedProduct) {
        const accent = brandAccent(brand ?? selectedProduct.brand);
        return (
            <div className="mx-auto max-w-xl space-y-4 animate-in fade-in-0 slide-in-from-bottom-4 duration-300">
                <button
                    type="button"
                    onClick={goBack}
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                    <ChevronLeft className="size-4" />
                    {regionProducts.length > 1 ? `Productos de ${brand}` : 'Todas las marcas'}
                </button>
                <div className="flex items-center gap-3">
                    <span
                        className={cn(
                            'flex size-12 shrink-0 items-center justify-center rounded-2xl shadow-inner sm:size-14',
                            accent.bg,
                            accent.fg,
                        )}
                    >
                        {region ? <RegionFlag region={region} className="text-3xl" /> : <Package className="size-6" />}
                    </span>
                    <div className="min-w-0">
                        <h2 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{brand}</h2>
                        {/* Nombre completo: sin truncar, es lo que identifica el producto pedido. */}
                        <p className="text-sm leading-snug text-muted-foreground sm:text-base">{selectedProduct.name}</p>
                    </div>
                </div>
                <CheckoutPanel
                    key={selectedProduct.id}
                    product={selectedProduct}
                    region={region}
                    prices={prices}
                    pricesStatus={pricesStatus}
                    onRetryPrices={onRetryPrices}
                    balance={balance}
                    isPlatform={isPlatform}
                    companies={companies}
                    storesForSelectedCompany={storesForSelectedCompany}
                    targetCompanyId={targetCompanyId}
                    targetStoreId={targetStoreId}
                    onTargetCompanyChange={onTargetCompanyChange}
                    onTargetStoreChange={onTargetStoreChange}
                    targetOriginPhoneId={targetOriginPhoneId}
                    originPhones={originPhones}
                    onTargetOriginPhoneChange={onTargetOriginPhoneChange}
                    isPurchasing={isPurchasing}
                    onPurchase={onPurchase}
                    onPurchaseBatch={onPurchaseBatch}
                />
            </div>
        );
    }

    const breadcrumb = [
        region ? `${REGION_META[region].flag} ${REGION_META[region].shortLabel}` : null,
        brand,
    ].filter(Boolean) as string[];

    return (
        <Card className="mx-auto max-w-xl overflow-hidden shadow-sm">
            <CardHeader className="space-y-4 border-b bg-card pb-5">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <CardTitle className="text-xl sm:text-2xl">
                            {step === 'region' && '¿Para qué región?'}
                            {step === 'brand' && '¿Qué marca?'}
                            {step === 'product' && 'Elige el producto'}
                        </CardTitle>
                        <CardDescription className="mt-1">
                            {step === 'region' && 'Separa USA y Colombia para evitar compras en la región equivocada.'}
                            {step === 'brand' && region && `Marcas disponibles en ${REGION_META[region].label}.`}
                            {step === 'product' && brand && `Productos de ${brand}.`}
                        </CardDescription>
                    </div>
                    {step !== 'region' && (
                        <Button
                            type="button"
                            variant="outline"
                            size="lg"
                            className="h-12 shrink-0 gap-2 px-4"
                            onClick={goBack}
                        >
                            <ArrowLeft className="size-4" />
                            <span className="hidden sm:inline">Atrás</span>
                        </Button>
                    )}
                </div>

                {breadcrumb.length > 0 && (
                    <nav
                        aria-label="Selección actual"
                        className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground"
                    >
                        {breadcrumb.map((crumb, i) => (
                            <span key={`${crumb}-${i}`} className="inline-flex items-center gap-1.5">
                                {i > 0 && <ChevronRight className="size-3.5 opacity-50" aria-hidden />}
                                <span className={cn(i === breadcrumb.length - 1 && 'font-medium text-foreground')}>
                                    {crumb}
                                </span>
                            </span>
                        ))}
                    </nav>
                )}

                <StepBar step={step} />
            </CardHeader>

            <CardContent key={step} className="space-y-6 pt-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-300">
                {step === 'region' && (
                    <div className="grid gap-3">
                        {availableRegions.length === 0 && (
                            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                {productsError || 'No hay productos disponibles para comprar.'}
                            </p>
                        )}
                        {availableRegions.map((r) => {
                            const meta = REGION_META[r];
                            const count = filterProductsByRegion(products, r).length;
                            return (
                                <SelectionTile
                                    key={r}
                                    selected={region === r}
                                    onClick={() => selectRegion(r)}
                                    className="min-h-[5.5rem]"
                                >
                                    <RegionFlag region={r} className="text-4xl sm:text-5xl" />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-lg font-semibold tracking-tight sm:text-xl">
                                            {meta.label}
                                        </p>
                                        <p className="mt-0.5 text-sm text-muted-foreground">
                                            {meta.description} · {count} producto{count === 1 ? '' : 's'}
                                        </p>
                                    </div>
                                    <ArrowRight className="size-5 shrink-0 text-muted-foreground" />
                                </SelectionTile>
                            );
                        })}
                        {productsError && availableRegions.length > 0 && (
                            <p className="text-sm text-amber-700">{productsError}</p>
                        )}
                    </div>
                )}

                {step === 'brand' && region && (
                    <div className="grid gap-3 sm:grid-cols-2">
                        {brands.map((b) => {
                            const accent = brandAccent(b);
                            const count = filterProductsByRegionAndBrand(products, region, b).length;
                            return (
                                <SelectionTile
                                    key={b}
                                    selected={brand === b}
                                    onClick={() => selectBrand(b)}
                                    className="min-h-[5.25rem] sm:flex-col sm:items-stretch sm:gap-3"
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className={cn(
                                                'flex size-14 shrink-0 items-center justify-center rounded-2xl text-2xl shadow-inner',
                                                accent.bg,
                                                accent.fg,
                                            )}
                                        >
                                            <RegionFlag region={region} className="text-3xl" />
                                        </div>
                                        <div className="min-w-0 flex-1 sm:pr-6">
                                            <p className="text-base font-semibold sm:text-lg">{b}</p>
                                            <p className="text-xs text-muted-foreground sm:text-sm">
                                                {REGION_META[region].flag} {REGION_META[region].shortLabel}
                                                {' · '}
                                                {count} opción{count === 1 ? '' : 'es'}
                                            </p>
                                        </div>
                                    </div>
                                </SelectionTile>
                            );
                        })}
                    </div>
                )}

                {step === 'product' && (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {regionProducts.length === 0 && (
                            <p className="col-span-full text-sm text-muted-foreground">No hay productos para esta marca.</p>
                        )}
                        {regionProducts.map((product) => {
                            const units = productStock(product);
                            const label = stockLabel(units);
                            const price = tilePrice(product);
                            const empty = units != null && units <= 0;
                            return (
                                <SelectionTile
                                    key={product.id}
                                    selected={productId === product.id}
                                    onClick={() => selectProduct(product.id)}
                                    className="min-h-0 flex-col items-start gap-0.5 rounded-xl px-3 py-2.5"
                                >
                                    <span className="w-full text-base font-semibold leading-snug" title={product.name}>
                                        {productLabels.get(product.id) ?? product.name}
                                    </span>
                                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                                        {price
                                            ? `${price.from ? 'desde ' : ''}${formatMoney(price.amount, price.currency)}`
                                            : pricesStatus === 'loading'
                                                ? <Skeleton className="h-3 w-16" aria-label="Cargando precio" />
                                                : product.denominations.length > 1
                                                    ? `${product.denominations.length} valores`
                                                    : '—'}
                                    </span>
                                    {label && (
                                        <span className={cn('text-[11px]', empty ? 'font-medium text-amber-800 dark:text-amber-400' : 'text-muted-foreground')}>
                                            {label}
                                        </span>
                                    )}
                                </SelectionTile>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
