'use client';

import { useMemo, useState, type ReactNode } from 'react';
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
    filterProductsByRegion,
    filterProductsByRegionAndBrand,
    formatDenomAmount,
    productRegions,
    productStock,
    stockLabel,
} from '@/lib/codes/catalog-regions';
import { CheckoutPanel, type OriginPhone, type PriceRow, type WalletBalance } from './CheckoutPanel';

export type { OriginPhone, PriceRow, WalletBalance } from './CheckoutPanel';

export type WizardStep = 'region' | 'brand' | 'product' | 'order';

export interface PurchaseWizardProps {
    products: CatalogProduct[];
    productsError: string | null;
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
    onPurchase: (payload: {
        productId: string;
        denominationId: string | null;
        count: number;
        quotedUnitAmount: number;
        quotedCurrency: string;
        quotedRate?: number | null;
    }) => void;
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
}: PurchaseWizardProps) {
    const [step, setStep] = useState<WizardStep>('region');
    const [region, setRegion] = useState<BuyRegion | null>(null);
    const [brand, setBrand] = useState<string | null>(null);
    const [productId, setProductId] = useState('');

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

    function goBack() {
        if (step === 'order') {
            setStep(regionProducts.length > 1 ? 'product' : 'brand');
        } else if (step === 'product') {
            setStep('brand');
        } else if (step === 'brand') {
            setStep('region');
        }
    }

    function selectRegion(next: BuyRegion) {
        setRegion(next);
        setBrand(null);
        setProductId('');
        setStep('brand');
    }

    function selectBrand(next: string) {
        setBrand(next);
        const options = region ? filterProductsByRegionAndBrand(products, region, next) : [];
        if (options.length === 1) {
            setProductId(options[0].id);
            setStep('order');
            return;
        }
        setProductId('');
        setStep('product');
    }

    function selectProduct(nextId: string) {
        setProductId(nextId);
        setStep('order');
    }

    if (step === 'order' && selectedProduct) {
        const accent = brandAccent(brand ?? selectedProduct.brand);
        return (
            <div className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-300">
                <button
                    type="button"
                    onClick={goBack}
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                    <ChevronLeft className="size-4" />
                    {regionProducts.length > 1 ? `Productos de ${brand}` : 'Todas las marcas'}
                </button>
                <div className="flex items-center gap-4">
                    <span
                        className={cn(
                            'flex size-14 shrink-0 items-center justify-center rounded-2xl shadow-inner sm:size-16',
                            accent.bg,
                            accent.fg,
                        )}
                    >
                        {region ? <RegionFlag region={region} className="text-3xl" /> : <Package className="size-6" />}
                    </span>
                    <div className="min-w-0">
                        <h2 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">{brand}</h2>
                        <p className="truncate text-sm text-muted-foreground sm:text-base">{selectedProduct.name}</p>
                    </div>
                </div>
                <CheckoutPanel
                    key={selectedProduct.id}
                    product={selectedProduct}
                    region={region}
                    prices={prices}
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
                    <div className="grid gap-3">
                        {regionProducts.length === 0 && (
                            <p className="text-sm text-muted-foreground">No hay productos para esta marca.</p>
                        )}
                        {regionProducts.map((product) => {
                            const denomSummary =
                                product.denominations.length === 1
                                    ? formatDenomAmount(
                                        product.denominations[0].amount,
                                        product.denominations[0].currency,
                                    )
                                    : `${product.denominations.length} valores`;
                            const units = productStock(product);
                            const label = stockLabel(units);
                            return (
                                <SelectionTile
                                    key={product.id}
                                    selected={productId === product.id}
                                    onClick={() => selectProduct(product.id)}
                                    className="min-h-[4.75rem]"
                                >
                                    <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                        <Package className="size-5" />
                                    </div>
                                    <div className="min-w-0 flex-1 pr-2">
                                        <p className="text-base font-semibold leading-snug">{product.name}</p>
                                        <p className="mt-0.5 text-sm text-muted-foreground">
                                            {region && (
                                                <>
                                                    <RegionFlag region={region} className="mr-1 text-sm" />
                                                    {REGION_META[region].shortLabel}
                                                    {' · '}
                                                </>
                                            )}
                                            {denomSummary}
                                            {label && (
                                                <>
                                                    {' · '}
                                                    <span className={units != null && units <= 0 ? 'font-medium text-amber-800' : ''}>
                                                        {label}
                                                    </span>
                                                </>
                                            )}
                                        </p>
                                    </div>
                                    <ArrowRight className="size-5 shrink-0 text-muted-foreground" />
                                </SelectionTile>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
