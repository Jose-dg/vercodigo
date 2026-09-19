'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    AlertCircle,
    ArrowLeft,
    ArrowRight,
    Building2,
    ChevronRight,
    Hash,
    Loader2,
    Minus,
    Package,
    Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    BuyRegion,
    CatalogProduct,
    REGION_META,
    brandAccent,
    brandsInRegion,
    filterProductsByRegionAndBrand,
    formatDenomAmount,
    resolveProductRegion,
} from '@/lib/codes/catalog-regions';

export type WizardStep = 'region' | 'brand' | 'product' | 'denomination' | 'quantity';

export interface PriceRow {
    productId: string;
    denominationId: string | null;
    salePrice: number | null;
    currency: string | null;
}

export interface PurchaseWizardProps {
    products: CatalogProduct[];
    productsError: string | null;
    prices: PriceRow[];
    isPlatform: boolean;
    companies: { companyId: string; companyName: string }[];
    storesForSelectedCompany: { id: string; name: string; companyId: string }[];
    targetCompanyId: string;
    targetStoreId: string;
    onTargetCompanyChange: (companyId: string) => void;
    onTargetStoreChange: (storeId: string) => void;
    isPurchasing: boolean;
    onPurchase: (payload: {
        productId: string;
        denominationId: string | null;
        count: number;
    }) => void;
}

const STEP_ORDER: WizardStep[] = ['region', 'brand', 'product', 'denomination', 'quantity'];

function stepIndex(step: WizardStep): number {
    return STEP_ORDER.indexOf(step);
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

export function PurchaseWizard({
    products,
    productsError,
    prices,
    isPlatform,
    companies,
    storesForSelectedCompany,
    targetCompanyId,
    targetStoreId,
    onTargetCompanyChange,
    onTargetStoreChange,
    isPurchasing,
    onPurchase,
}: PurchaseWizardProps) {
    const [step, setStep] = useState<WizardStep>('region');
    const [region, setRegion] = useState<BuyRegion | null>(null);
    const [brand, setBrand] = useState<string | null>(null);
    const [productId, setProductId] = useState('');
    const [denominationId, setDenominationId] = useState('');
    const [quantity, setQuantity] = useState(1);

    const availableRegions = useMemo(() => {
        const present = new Set(products.map(resolveProductRegion));
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

    const selectedProduct = products.find((p) => p.id === productId);
    const needsDenomination = (selectedProduct?.denominations.length ?? 0) > 1;
    const effectiveDenominationId = needsDenomination
        ? denominationId
        : selectedProduct?.denominations[0]?.id ?? null;
    const selectedDenomination = selectedProduct?.denominations.find(
        (d) => d.id === effectiveDenominationId,
    );

    const referencePrice = prices.find(
        (p) =>
            p.productId === productId
            && p.denominationId === (effectiveDenominationId ?? null),
    );
    const estimatedTotal =
        referencePrice?.salePrice != null ? referencePrice.salePrice * quantity : null;

    const selectedCompany = companies.find((c) => c.companyId === targetCompanyId);

    const canConfirm =
        Boolean(productId)
        && (!needsDenomination || Boolean(denominationId))
        && quantity >= 1
        && quantity <= 100
        && (!isPlatform || Boolean(targetCompanyId));

    function resetFrom(from: WizardStep) {
        if (stepIndex(from) <= stepIndex('region')) {
            setRegion(null);
            setBrand(null);
            setProductId('');
            setDenominationId('');
        } else if (stepIndex(from) <= stepIndex('brand')) {
            setBrand(null);
            setProductId('');
            setDenominationId('');
        } else if (stepIndex(from) <= stepIndex('product')) {
            setProductId('');
            setDenominationId('');
        } else if (stepIndex(from) <= stepIndex('denomination')) {
            setDenominationId('');
        }
    }

    function goBack() {
        if (step === 'quantity') {
            setStep(needsDenomination ? 'denomination' : 'product');
            return;
        }
        if (step === 'denomination') {
            setStep('product');
            return;
        }
        if (step === 'product') {
            setStep('brand');
            return;
        }
        if (step === 'brand') {
            setStep('region');
        }
    }

    function selectRegion(next: BuyRegion) {
        resetFrom('region');
        setRegion(next);
        setBrand(null);
        setProductId('');
        setDenominationId('');
        setStep('brand');
    }

    function selectBrand(next: string) {
        resetFrom('brand');
        setBrand(next);
        setProductId('');
        setDenominationId('');
        setStep('product');
    }

    function selectProduct(nextId: string) {
        const product = products.find((p) => p.id === nextId);
        setProductId(nextId);
        setDenominationId('');
        if ((product?.denominations.length ?? 0) > 1) {
            setStep('denomination');
        } else {
            setStep('quantity');
        }
    }

    function selectDenomination(nextId: string) {
        setDenominationId(nextId);
        setStep('quantity');
    }

    function bumpQuantity(delta: number) {
        setQuantity((q) => Math.min(100, Math.max(1, q + delta)));
    }

    const progressLabel = (() => {
        if (step === 'region') return 'Paso 1 · Región';
        if (step === 'brand') return 'Paso 2 · Marca';
        if (step === 'product') return 'Paso 3 · Producto';
        if (step === 'denomination') return 'Paso 4 · Valor';
        return 'Paso final · Cantidad';
    })();

    const breadcrumb = [
        region ? `${REGION_META[region].flag} ${REGION_META[region].shortLabel}` : null,
        brand,
        selectedProduct?.name ?? null,
        selectedDenomination
            ? formatDenomAmount(selectedDenomination.amount, selectedDenomination.currency)
            : null,
    ].filter(Boolean) as string[];

    return (
        <Card className="mx-auto max-w-xl overflow-hidden shadow-sm">
            <CardHeader className="space-y-4 border-b bg-card pb-5">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-xs font-medium text-muted-foreground">{progressLabel}</p>
                        <CardTitle className="mt-1 text-xl sm:text-2xl">
                            {step === 'region' && '¿Para qué región?'}
                            {step === 'brand' && '¿Qué marca?'}
                            {step === 'product' && 'Elige el producto'}
                            {step === 'denomination' && 'Elige el valor'}
                            {step === 'quantity' && 'Confirma la cantidad'}
                        </CardTitle>
                        <CardDescription className="mt-1">
                            {step === 'region' && 'Separa USA y Colombia para evitar compras en la región equivocada.'}
                            {step === 'brand' && region && `Marcas disponibles en ${REGION_META[region].label}.`}
                            {step === 'product' && brand && `Productos de ${brand}.`}
                            {step === 'denomination' && 'Toca el monto exacto que necesitas.'}
                            {step === 'quantity' && 'Revisa el resumen antes de confirmar.'}
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

                <ol className="flex gap-1.5" aria-hidden>
                    {STEP_ORDER.filter((s) => s !== 'denomination' || needsDenomination || step === 'denomination').map(
                        (s) => {
                            const active = s === step;
                            const done = stepIndex(s) < stepIndex(step);
                            return (
                                <li
                                    key={s}
                                    className={cn(
                                        'h-1.5 flex-1 rounded-full transition-colors',
                                        active ? 'bg-primary' : done ? 'bg-primary/40' : 'bg-muted',
                                    )}
                                />
                            );
                        },
                    )}
                </ol>
            </CardHeader>

            <CardContent className="space-y-6 pt-6">
                {isPlatform && step === 'quantity' && (
                    <section className="space-y-4" aria-labelledby="company-section">
                        <div className="flex items-center gap-3">
                            <div className="flex size-10 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
                                <Building2 className="size-5" />
                            </div>
                            <div>
                                <h2 id="company-section" className="text-sm font-semibold">
                                    Empresa que realiza la compra
                                </h2>
                                <p className="text-xs text-muted-foreground">
                                    El cargo se aplica a la wallet seleccionada.
                                </p>
                            </div>
                        </div>
                        <div className="grid gap-4 rounded-2xl border border-amber-200/80 bg-amber-50/60 p-4">
                            <div className="space-y-2">
                                <Label htmlFor="target-company">Empresa</Label>
                                <Select
                                    value={targetCompanyId || undefined}
                                    onValueChange={(value) => {
                                        onTargetCompanyChange(value);
                                        onTargetStoreChange('');
                                    }}
                                >
                                    <SelectTrigger id="target-company" className="h-12 bg-background text-base">
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
                            <div className="space-y-2">
                                <Label htmlFor="target-store">
                                    Tienda <span className="font-normal text-muted-foreground">(opcional)</span>
                                </Label>
                                <Select
                                    value={targetStoreId || undefined}
                                    onValueChange={onTargetStoreChange}
                                    disabled={!targetCompanyId}
                                >
                                    <SelectTrigger id="target-store" className="h-12 bg-background text-base">
                                        <SelectValue placeholder="Sin tienda específica" />
                                    </SelectTrigger>
                                    <SelectContent position="popper" className="z-[100]">
                                        {storesForSelectedCompany.map((store) => (
                                            <SelectItem key={store.id} value={store.id}>
                                                {store.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </section>
                )}

                {step === 'region' && (
                    <div className="grid gap-3">
                        {availableRegions.length === 0 && (
                            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                {productsError || 'No hay productos disponibles para comprar.'}
                            </p>
                        )}
                        {availableRegions.map((r) => {
                            const meta = REGION_META[r];
                            const count = products.filter((p) => resolveProductRegion(p) === r).length;
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
                                        </p>
                                    </div>
                                    <ArrowRight className="size-5 shrink-0 text-muted-foreground" />
                                </SelectionTile>
                            );
                        })}
                    </div>
                )}

                {step === 'denomination' && selectedProduct && (
                    <div className="grid grid-cols-2 gap-3">
                        {selectedProduct.denominations.map((denom) => (
                            <SelectionTile
                                key={denom.id}
                                selected={denominationId === denom.id}
                                onClick={() => selectDenomination(denom.id)}
                                className="min-h-20 flex-col items-start justify-center gap-1 sm:min-h-24"
                            >
                                <span className="text-lg font-bold tabular-nums sm:text-xl">
                                    {formatDenomAmount(denom.amount, denom.currency)}
                                </span>
                                <span className="text-xs text-muted-foreground">{denom.currency}</span>
                            </SelectionTile>
                        ))}
                    </div>
                )}

                {step === 'quantity' && selectedProduct && (
                    <section className="space-y-5" aria-labelledby="quantity-section">
                        <div className="rounded-2xl border bg-muted/30 p-4">
                            <div className="flex items-start gap-3">
                                {region && <RegionFlag region={region} className="mt-0.5 text-3xl" />}
                                <div className="min-w-0">
                                    <p className="text-xs text-muted-foreground">Resumen</p>
                                    <p className="font-semibold leading-snug">{selectedProduct.name}</p>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        {brand}
                                        {selectedDenomination && (
                                            <>
                                                {' · '}
                                                {formatDenomAmount(
                                                    selectedDenomination.amount,
                                                    selectedDenomination.currency,
                                                )}
                                            </>
                                        )}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                    <Hash className="size-5" />
                                </div>
                                <div>
                                    <h2 id="quantity-section" className="text-sm font-semibold">
                                        Cantidad de códigos
                                    </h2>
                                    <p className="text-xs text-muted-foreground">Entre 1 y 100</p>
                                </div>
                            </div>

                            <div className="flex items-center justify-center gap-3">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="size-14 rounded-2xl"
                                    onClick={() => bumpQuantity(-1)}
                                    disabled={quantity <= 1}
                                    aria-label="Disminuir cantidad"
                                >
                                    <Minus className="size-6" />
                                </Button>
                                <Input
                                    id="quantity"
                                    type="number"
                                    min={1}
                                    max={100}
                                    inputMode="numeric"
                                    value={quantity}
                                    onChange={(event) => {
                                        const next = parseInt(event.target.value, 10);
                                        if (Number.isNaN(next)) {
                                            setQuantity(1);
                                            return;
                                        }
                                        setQuantity(Math.min(100, Math.max(1, next)));
                                    }}
                                    className="h-14 w-24 rounded-2xl text-center font-mono text-2xl font-semibold tabular-nums"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="size-14 rounded-2xl"
                                    onClick={() => bumpQuantity(1)}
                                    disabled={quantity >= 100}
                                    aria-label="Aumentar cantidad"
                                >
                                    <Plus className="size-6" />
                                </Button>
                            </div>
                        </div>

                        {referencePrice?.salePrice != null && (
                            <div className="rounded-2xl border bg-muted/40 px-4 py-3">
                                <p className="text-xs text-muted-foreground">Precio por unidad</p>
                                <p className="mt-1 font-mono text-lg font-semibold tabular-nums">
                                    {referencePrice.salePrice.toLocaleString('es-CO')}{' '}
                                    {referencePrice.currency}
                                </p>
                            </div>
                        )}

                        <div className="flex gap-3 rounded-2xl border border-blue-200/70 bg-blue-50/70 p-4 text-sm text-blue-900">
                            <AlertCircle className="mt-0.5 size-5 shrink-0 text-blue-600" />
                            <div>
                                <p className="font-semibold">Entrega protegida por Diem</p>
                                <p className="mt-1 leading-relaxed text-blue-800">
                                    La wallet se debita solo cuando la entrega se completa.
                                </p>
                            </div>
                        </div>
                    </section>
                )}
            </CardContent>

            {step === 'quantity' && (
                <CardFooter className="flex flex-col gap-4 border-t bg-muted/30 px-6 py-5">
                    <div className="w-full text-sm">
                        <p className="text-muted-foreground">
                            {isPlatform
                                ? (selectedCompany?.companyName ?? 'Selecciona una empresa')
                                : 'Compra para tu empresa'}
                        </p>
                        {estimatedTotal != null && (
                            <p className="mt-0.5 text-base font-semibold">
                                Total estimado:{' '}
                                <span className="font-mono tabular-nums">
                                    {estimatedTotal.toLocaleString('es-CO')} {referencePrice?.currency}
                                </span>
                            </p>
                        )}
                    </div>
                    <Button
                        className="h-14 w-full rounded-2xl text-base font-semibold transition-transform active:scale-[0.98]"
                        size="lg"
                        disabled={isPurchasing || !canConfirm}
                        onClick={() =>
                            onPurchase({
                                productId,
                                denominationId: effectiveDenominationId,
                                count: quantity,
                            })
                        }
                    >
                        {isPurchasing ? (
                            <>
                                <Loader2 className="mr-2 size-5 animate-spin" />
                                Procesando...
                            </>
                        ) : (
                            <>
                                Confirmar compra
                                <ArrowRight className="ml-2 size-5" />
                            </>
                        )}
                    </Button>
                </CardFooter>
            )}
        </Card>
    );
}
