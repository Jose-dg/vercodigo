'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { isPlatformRole } from '@/lib/auth/abilities';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ShoppingCart, Check, AlertCircle, Copy, History, Building2, Package, Hash, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PurchaseHistoryPanel } from '@/components/codes/PurchaseHistoryPanel';
import type { UserRole } from '@prisma/client';

interface Product {
    id: string;
    name: string;
    brand: string;
    isActive: boolean;
    devDiemProductId: string | null;
    denominations: {
        id: string;
        amount: number;
        currency: string;
        devDiemProductId: string | null;
    }[];
}

interface PriceRow {
    productId: string;
    denominationId: string | null;
    salePrice: number | null;
    currency: string | null;
}

interface PurchaseResponse {
    success: boolean;
    purchase: {
        id: string;
        count: number;
        totalAmount: number;
        currency: string;
        status: string;
        fulfillmentStatus?: string | null;
        isPending: boolean;
        isSuccessful: boolean;
        needsAction: boolean;
        createdAt: string;
        keys: { code: string }[];
    };
}

export default function PurchaseCodesPage() {
    const { data: session, status: sessionStatus } = useSession();
    const isPlatform =
        session?.user?.role != null && isPlatformRole(session.user.role as UserRole);
    const [products, setProducts] = useState<Product[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [productsError, setProductsError] = useState<string | null>(null);

    const [selectedProductId, setSelectedProductId] = useState('');
    const [selectedDenominationId, setSelectedDenominationId] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [isPurchasing, setIsPurchasing] = useState(false);
    const [prices, setPrices] = useState<PriceRow[]>([]);

    const [purchaseResult, setPurchaseResult] = useState<PurchaseResponse | null>(null);
    const [activeTab, setActiveTab] = useState('order');
    const [historyTick, setHistoryTick] = useState(0);
    const purchaseInFlightKey = useRef<string | null>(null);
    const [targetCompanyId, setTargetCompanyId] = useState('');
    const [targetStoreId, setTargetStoreId] = useState('');
    const [companies, setCompanies] = useState<{ companyId: string; companyName: string }[]>([]);
    const [platformStores, setPlatformStores] = useState<
        { id: string; name: string; companyId: string }[]
    >([]);
    const pendingPurchaseId = purchaseResult?.purchase?.isPending
        ? purchaseResult.purchase.id
        : null;

    useEffect(() => {
        if (!pendingPurchaseId) return;
        const timer = window.setInterval(async () => {
            const response = await fetch(`/api/codes/purchases/${pendingPurchaseId}`, { cache: 'no-store' });
            const data = await response.json().catch(() => null);
            if (response.ok && data?.purchase) {
                setPurchaseResult(data);
                if (data.purchase.status === 'COMPLETED') {
                    toast.success("Códigos entregados");
                    setHistoryTick((tick) => tick + 1);
                    window.clearInterval(timer);
                } else if (data.purchase.status === 'FAILED') {
                    toast.error("La entrega falló y no se debitó la wallet.");
                    window.clearInterval(timer);
                } else if (data.purchase.status === 'ACTION_REQUIRED') {
                    toast.error("La entrega necesita revisión manual.");
                    window.clearInterval(timer);
                }
            }
        }, 3000);
        return () => window.clearInterval(timer);
    }, [pendingPurchaseId]);

    useEffect(() => {
        if (sessionStatus === 'loading') return;

        if (sessionStatus !== 'authenticated') {
            setLoadingProducts(false);
            setProductsError('Debes iniciar sesión para ver el catálogo de compra.');
            return;
        }

        let cancelled = false;

        async function loadCatalog() {
            setLoadingProducts(true);
            setProductsError(null);
            try {
                const res = await fetch('/api/products?purchasable=true', {
                    credentials: 'include',
                    cache: 'no-store',
                });
                const data = await res.json().catch(() => null);

                if (cancelled) return;

                if (!res.ok) {
                    const rawMessage =
                        (data && typeof data.error === 'string' && data.error)
                        || (data && typeof data.detail === 'string' && data.detail)
                        || 'No se pudieron cargar los productos disponibles.';
                    const message = /invalid api key/i.test(rawMessage)
                        ? 'Diem rechazó la API key. Verifica DIEM_SERVICE_API_KEY en .env.local (debe ser la misma que en Vercel).'
                        : rawMessage;
                    setProducts([]);
                    setProductsError(message);
                    toast.error(message);
                    return;
                }

                if (!Array.isArray(data)) {
                    setProducts([]);
                    setProductsError('Respuesta inválida del catálogo de productos.');
                    return;
                }

                const purchasableProducts = (data as Product[])
                    .filter(product => product.isActive)
                    .map(product => ({
                        ...product,
                        denominations: product.denominations.filter(
                            denomination =>
                                Boolean(denomination.devDiemProductId || product.devDiemProductId),
                        ),
                    }))
                    .filter(product =>
                        Boolean(product.devDiemProductId || product.denominations.length > 0),
                    );

                setProducts(purchasableProducts);
                if (purchasableProducts.length === 0) {
                    setProductsError(
                        'No hay productos habilitados para compra. Revisa el mapeo con Diem y que estén activos.',
                    );
                }
            } catch (err) {
                if (cancelled) return;
                console.error(err);
                setProducts([]);
                setProductsError('Error al cargar productos.');
                toast.error('Error al cargar productos');
            } finally {
                if (!cancelled) setLoadingProducts(false);
            }
        }

        loadCatalog();

        fetch('/api/prices', { credentials: 'include' })
            .then(res => (res.ok ? res.json() : null))
            .then(data => {
                if (data?.rows) setPrices(data.rows);
            })
            .catch(() => { });

        return () => {
            cancelled = true;
        };
    }, [sessionStatus]);

    useEffect(() => {
        if (!isPlatform) return;
        fetch('/api/wallets', { credentials: 'include' })
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (data?.wallets) {
                    setCompanies(
                        data.wallets.map((w: { companyId: string; companyName: string }) => ({
                            companyId: w.companyId,
                            companyName: w.companyName,
                        })),
                    );
                }
            })
            .catch(() => undefined);
        fetch('/api/stores')
            .then((res) => (res.ok ? res.json() : []))
            .then((rows) => {
                if (Array.isArray(rows)) {
                    setPlatformStores(
                        rows.map((s: { id: string; name: string; companyId: string }) => ({
                            id: s.id,
                            name: s.name,
                            companyId: s.companyId,
                        })),
                    );
                }
            })
            .catch(() => undefined);
    }, [isPlatform]);

    const storesForSelectedCompany = platformStores.filter(
        (store) => store.companyId === targetCompanyId,
    );

    const selectedProduct = products.find(p => p.id === selectedProductId);
    const needsDenomination = (selectedProduct?.denominations.length ?? 0) > 1;
    const effectiveDenominationId = needsDenomination
        ? selectedDenominationId
        : selectedProduct?.denominations[0]?.id ?? null;
    const referencePrice = prices.find(
        p => p.productId === selectedProductId && p.denominationId === (effectiveDenominationId ?? null)
    );

    const handlePurchase = async () => {
        if (!selectedProductId) {
            toast.error("Seleccione un producto");
            return;
        }
        if (needsDenomination && !selectedDenominationId) {
            toast.error("Seleccione la denominación");
            return;
        }
        if (quantity < 1 || quantity > 100) {
            toast.error("Cantidad inválida (1-100)");
            return;
        }
        if (isPlatform && !targetCompanyId) {
            toast.error("Selecciona la empresa que recibirá el cargo");
            return;
        }

        setIsPurchasing(true);
        if (!purchaseInFlightKey.current) {
            purchaseInFlightKey.current = crypto.randomUUID();
        }
        const idempotencyKey = purchaseInFlightKey.current;
        try {
            const res = await fetch('/api/codes/purchase', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Idempotency-Key': idempotencyKey,
                },
                body: JSON.stringify({
                    productId: selectedProductId,
                    denominationId: effectiveDenominationId || undefined,
                    count: quantity,
                    ...(isPlatform
                        ? {
                              companyId: targetCompanyId,
                              storeId: targetStoreId || undefined,
                          }
                        : {}),
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                const apiMessage =
                    (typeof data?.message === 'string' && data.message)
                    || (typeof data?.error === 'string' && data.error)
                    || null;
                if (res.status === 409) {
                    toast.error(
                        apiMessage?.includes('Idempotency-Key')
                            ? 'Este intento de compra ya se usó con otra cantidad o producto. Vuelve a confirmar la compra.'
                            : apiMessage || 'Stock insuficiente',
                    );
                } else {
                    toast.error(apiMessage || 'Error al realizar la compra');
                }
                return;
            }

            setPurchaseResult(data);
            setHistoryTick((tick) => tick + 1);
            if (data.purchase?.isPending) {
                setActiveTab('history');
                toast.success("Solicitud recibida. Quedó pendiente de entrega.");
            } else if (data.purchase?.status === 'COMPLETED') {
                setActiveTab('history');
                toast.success("Compra exitosa");
            } else {
                toast.error("La solicitud necesita revisión.");
            }
        } catch (error) {
            console.error("Purchase error:", error);
            toast.error("Error de conexión");
        } finally {
            setIsPurchasing(false);
            purchaseInFlightKey.current = null;
        }
    };

    const handleReset = () => {
        setPurchaseResult(null);
        setQuantity(1);
        setSelectedProductId('');
        setSelectedDenominationId('');
        purchaseInFlightKey.current = null;
    };

    const copyAllCodes = () => {
        if (!purchaseResult) return;
        const codes = purchaseResult.purchase.keys.map(k => k.code).join('\n');
        navigator.clipboard.writeText(codes);
        toast.success("Códigos copiados al portapapeles");
    };

    if (loadingProducts) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    const pendingResult = purchaseResult?.purchase.isPending;
    const successfulResult = purchaseResult?.purchase.isSuccessful;
    const needsActionResult = purchaseResult?.purchase.needsAction;
    const pendingManualReview =
        purchaseResult?.purchase.fulfillmentStatus === 'pending_review';
    const selectedCompany = companies.find((company) => company.companyId === targetCompanyId);
    const estimatedTotal =
        referencePrice?.salePrice != null ? referencePrice.salePrice * quantity : null;
    const canPurchase =
        Boolean(selectedProductId)
        && (!needsDenomination || Boolean(selectedDenominationId))
        && quantity >= 1
        && quantity <= 100
        && (!isPlatform || Boolean(targetCompanyId));

    return (
        <main className="min-h-full bg-muted/20">
            <div className="container max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
                <header className="mb-8 flex items-start gap-4">
                    <div className="hidden size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm sm:flex">
                        <ShoppingCart className="size-5" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Comprar códigos</h1>
                        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                            Solicita códigos digitales y consulta el estado de cada entrega.
                        </p>
                    </div>
                </header>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                    <TabsList className="grid h-11 w-full max-w-sm grid-cols-2 p-1">
                        <TabsTrigger value="order">Nueva orden</TabsTrigger>
                        <TabsTrigger value="history">Mis solicitudes</TabsTrigger>
                    </TabsList>

                    <TabsContent value="order" className="space-y-6">
                        {purchaseResult && (
                            <Card className="max-w-3xl overflow-hidden border-emerald-200 shadow-sm">
                                <CardHeader className="border-b border-emerald-100 bg-emerald-50/70">
                                    <CardTitle className="flex items-center gap-2 text-lg text-emerald-900">
                                        {pendingResult
                                            ? <Loader2 className="size-5 animate-spin text-blue-600" />
                                            : successfulResult
                                                ? <Check className="size-5 text-emerald-600" />
                                                : <AlertCircle className="size-5 text-red-600" />}
                                        {pendingResult
                                            ? pendingManualReview ? 'Confirmación operativa pendiente' : 'Solicitud pendiente en Diem'
                                            : successfulResult ? 'Compra entregada'
                                            : needsActionResult ? 'Revisión requerida' : 'Entrega fallida'}
                                    </CardTitle>
                                    <CardDescription>
                                        {pendingResult
                                            ? 'La solicitud ya está registrada. Puedes seguirla desde Mis solicitudes.'
                                            : successfulResult
                                                ? `Se entregaron ${purchaseResult.purchase.count} código(s).`
                                                : 'No se debitó la wallet.'}
                                    </CardDescription>
                                </CardHeader>
                                {successfulResult && (
                                    <CardContent className="space-y-4 pt-6">
                                        <ol className="max-h-52 divide-y divide-dashed overflow-y-auto rounded-lg border bg-muted/40 px-4 font-mono text-sm">
                                            {purchaseResult.purchase.keys.map((key, index) => (
                                                <li key={index} className="flex items-center gap-4 py-3">
                                                    <span className="w-6 text-muted-foreground">{index + 1}.</span>
                                                    <span className="select-all font-semibold">{key.code}</span>
                                                </li>
                                            ))}
                                        </ol>
                                        <Button variant="outline" onClick={copyAllCodes}>
                                            <Copy className="mr-2 size-4" />
                                            Copiar códigos
                                        </Button>
                                    </CardContent>
                                )}
                                <CardFooter className="flex-wrap gap-2 pt-6">
                                    <Button variant="outline" onClick={() => setActiveTab('history')}>
                                        <History className="mr-2 size-4" />
                                        Ver mis solicitudes
                                    </Button>
                                    <Button onClick={handleReset} disabled={pendingResult}>Nueva compra</Button>
                                </CardFooter>
                            </Card>
                        )}

                        <Card className="max-w-3xl overflow-hidden shadow-sm">
                            <CardHeader className="border-b bg-card pb-5">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <CardTitle className="text-xl">Nueva orden</CardTitle>
                                        <CardDescription className="mt-1">
                                            Completa los datos para reservar y entregar los códigos.
                                        </CardDescription>
                                    </div>
                                    <span className="hidden rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground sm:block">
                                        Máximo 100 códigos
                                    </span>
                                </div>
                            </CardHeader>

                            <CardContent className="space-y-8 pt-6">
                                {isPlatform && (
                                    <section className="space-y-4" aria-labelledby="company-section">
                                        <div className="flex items-center gap-3">
                                            <div className="flex size-8 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
                                                <Building2 className="size-4" />
                                            </div>
                                            <div>
                                                <h2 id="company-section" className="text-sm font-semibold">Empresa que realiza la compra</h2>
                                                <p className="text-xs text-muted-foreground">El cargo se aplicará a la wallet seleccionada.</p>
                                            </div>
                                        </div>
                                        <div className="grid gap-4 rounded-xl border border-amber-200/80 bg-amber-50/60 p-4 sm:grid-cols-2">
                                            <div className="space-y-2">
                                                <Label htmlFor="target-company">Empresa</Label>
                                                <Select
                                                    value={targetCompanyId || undefined}
                                                    onValueChange={(value) => {
                                                        setTargetCompanyId(value);
                                                        setTargetStoreId('');
                                                    }}
                                                >
                                                    <SelectTrigger id="target-company" className="bg-background">
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
                                                <Label htmlFor="target-store">Tienda <span className="font-normal text-muted-foreground">(opcional)</span></Label>
                                                <Select value={targetStoreId || undefined} onValueChange={setTargetStoreId} disabled={!targetCompanyId}>
                                                    <SelectTrigger id="target-store" className="bg-background">
                                                        <SelectValue placeholder="Sin tienda específica" />
                                                    </SelectTrigger>
                                                    <SelectContent position="popper" className="z-[100]">
                                                        {storesForSelectedCompany.map((store) => (
                                                            <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </section>
                                )}

                                <section className="space-y-4" aria-labelledby="product-section">
                                    <div className="flex items-center gap-3">
                                        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                            <Package className="size-4" />
                                        </div>
                                        <div>
                                            <h2 id="product-section" className="text-sm font-semibold">Producto y denominación</h2>
                                            <p className="text-xs text-muted-foreground">Selecciona el código digital que necesitas.</p>
                                        </div>
                                    </div>
                                    <div className={needsDenomination ? "grid gap-4 sm:grid-cols-2" : "grid gap-4"}>
                                        <div className="space-y-2">
                                            <Label htmlFor="product">Producto</Label>
                                            <Select
                                                value={selectedProductId || undefined}
                                                onValueChange={(value) => {
                                                    setSelectedProductId(value);
                                                    setSelectedDenominationId('');
                                                }}
                                                disabled={products.length === 0}
                                            >
                                                <SelectTrigger id="product">
                                                    <SelectValue placeholder="Seleccionar producto..." />
                                                </SelectTrigger>
                                                <SelectContent position="popper" className="z-[100]">
                                                    {products.map((product) => (
                                                        <SelectItem key={product.id} value={product.id}>
                                                            {product.name} · {product.brand}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            {productsError && <p className="text-sm text-amber-700">{productsError}</p>}
                                        </div>
                                        {needsDenomination && (
                                            <div className="space-y-2">
                                                <Label htmlFor="denomination">Denominación</Label>
                                                <Select value={selectedDenominationId || undefined} onValueChange={setSelectedDenominationId}>
                                                    <SelectTrigger id="denomination">
                                                        <SelectValue placeholder="Seleccionar denominación..." />
                                                    </SelectTrigger>
                                                    <SelectContent position="popper" className="z-[100]">
                                                        {selectedProduct?.denominations.map((denomination) => (
                                                            <SelectItem key={denomination.id} value={denomination.id}>
                                                                {denomination.amount.toLocaleString("es-CO")} {denomination.currency}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        )}
                                    </div>
                                </section>

                                <section className="space-y-4" aria-labelledby="quantity-section">
                                    <div className="flex items-center gap-3">
                                        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                            <Hash className="size-4" />
                                        </div>
                                        <div>
                                            <h2 id="quantity-section" className="text-sm font-semibold">Cantidad</h2>
                                            <p className="text-xs text-muted-foreground">Puedes solicitar entre 1 y 100 códigos.</p>
                                        </div>
                                    </div>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="quantity">Número de códigos</Label>
                                            <Input
                                                id="quantity"
                                                type="number"
                                                min={1}
                                                max={100}
                                                value={quantity}
                                                onChange={(event) => setQuantity(parseInt(event.target.value) || 0)}
                                                className="font-mono text-base tabular-nums"
                                            />
                                        </div>
                                        {referencePrice?.salePrice != null && (
                                            <div className="rounded-lg border bg-muted/40 px-4 py-3">
                                                <p className="text-xs text-muted-foreground">Precio configurado por unidad</p>
                                                <p className="mt-1 font-mono text-base font-semibold tabular-nums">
                                                    {referencePrice.salePrice.toLocaleString("es-CO")} {referencePrice.currency}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </section>

                                <div className="flex gap-3 rounded-xl border border-blue-200/70 bg-blue-50/70 p-4 text-sm text-blue-900">
                                    <AlertCircle className="mt-0.5 size-5 shrink-0 text-blue-600" />
                                    <div>
                                        <p className="font-semibold">Entrega protegida por Diem</p>
                                        <p className="mt-1 leading-relaxed text-blue-800">
                                            La wallet se debita únicamente cuando la entrega se completa.
                                        </p>
                                    </div>
                                </div>
                            </CardContent>

                            <CardFooter className="flex flex-col gap-4 border-t bg-muted/30 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0 text-sm">
                                    <p className="text-muted-foreground">
                                        {isPlatform ? (selectedCompany?.companyName ?? 'Selecciona una empresa') : 'Compra para tu empresa'}
                                    </p>
                                    {estimatedTotal != null && quantity > 0 && (
                                        <p className="mt-0.5 font-semibold">
                                            Total estimado: <span className="font-mono tabular-nums">{estimatedTotal.toLocaleString("es-CO")} {referencePrice?.currency}</span>
                                        </p>
                                    )}
                                </div>
                                <Button
                                    className="w-full transition-transform active:scale-[0.98] sm:w-auto sm:min-w-52"
                                    size="lg"
                                    onClick={handlePurchase}
                                    disabled={isPurchasing || !canPurchase}
                                >
                                    {isPurchasing ? (
                                        <><Loader2 className="mr-2 size-4 animate-spin" />Procesando...</>
                                    ) : (
                                        <>Confirmar compra<ArrowRight className="ml-2 size-4" /></>
                                    )}
                                </Button>
                            </CardFooter>
                        </Card>
                    </TabsContent>

                    <TabsContent value="history">
                        <PurchaseHistoryPanel refreshToken={historyTick} />
                    </TabsContent>
                </Tabs>
            </div>
        </main>
    );
}
