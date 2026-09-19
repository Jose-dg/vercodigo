'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { isPlatformRole } from '@/lib/auth/abilities';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Loader2, ShoppingCart, Check, AlertCircle, Copy, History } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PurchaseHistoryPanel } from '@/components/codes/PurchaseHistoryPanel';
import { PurchaseWizard } from '@/components/codes/PurchaseWizard';
import type { CatalogProduct } from '@/lib/codes/catalog-regions';
import type { UserRole } from '@prisma/client';

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
    const [products, setProducts] = useState<CatalogProduct[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [productsError, setProductsError] = useState<string | null>(null);

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
    const [wizardKey, setWizardKey] = useState(0);
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
                    toast.success('Códigos entregados');
                    setHistoryTick((tick) => tick + 1);
                    window.clearInterval(timer);
                } else if (data.purchase.status === 'FAILED') {
                    toast.error('La entrega falló y no se debitó la wallet.');
                    window.clearInterval(timer);
                } else if (data.purchase.status === 'ACTION_REQUIRED') {
                    toast.error('La entrega necesita revisión manual.');
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

                const purchasableProducts = (data as CatalogProduct[])
                    .filter((product) => product.isActive)
                    .map((product) => ({
                        ...product,
                        denominations: product.denominations.filter(
                            (denomination) =>
                                Boolean(denomination.devDiemProductId || product.devDiemProductId),
                        ),
                    }))
                    .filter((product) =>
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
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
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

    const handlePurchase = async (payload: {
        productId: string;
        denominationId: string | null;
        count: number;
    }) => {
        if (!payload.productId) {
            toast.error('Seleccione un producto');
            return;
        }
        if (payload.count < 1 || payload.count > 100) {
            toast.error('Cantidad inválida (1-100)');
            return;
        }
        if (isPlatform && !targetCompanyId) {
            toast.error('Selecciona la empresa que recibirá el cargo');
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
                    productId: payload.productId,
                    denominationId: payload.denominationId || undefined,
                    count: payload.count,
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
                toast.success('Solicitud recibida. Quedó pendiente de entrega.');
            } else if (data.purchase?.status === 'COMPLETED') {
                setActiveTab('history');
                toast.success('Compra exitosa');
            } else {
                toast.error('La solicitud necesita revisión.');
            }
        } catch (error) {
            console.error('Purchase error:', error);
            toast.error('Error de conexión');
        } finally {
            setIsPurchasing(false);
            purchaseInFlightKey.current = null;
        }
    };

    const handleReset = () => {
        setPurchaseResult(null);
        purchaseInFlightKey.current = null;
        setWizardKey((k) => k + 1);
        setActiveTab('order');
    };

    const copyAllCodes = () => {
        if (!purchaseResult) return;
        const codes = purchaseResult.purchase.keys.map((k) => k.code).join('\n');
        navigator.clipboard.writeText(codes);
        toast.success('Códigos copiados al portapapeles');
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

    return (
        <main className="min-h-full bg-muted/20">
            <div className="container max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
                <header className="mb-6 flex items-start gap-4 sm:mb-8">
                    <div className="hidden size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm sm:flex">
                        <ShoppingCart className="size-5" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight sm:text-4xl">Comprar códigos</h1>
                        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                            Elige región, marca y producto paso a paso. Pensado para comprar fácil desde el celular.
                        </p>
                    </div>
                </header>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                    <TabsList className="grid h-12 w-full max-w-sm grid-cols-2 p-1">
                        <TabsTrigger value="order" className="text-sm">Nueva orden</TabsTrigger>
                        <TabsTrigger value="history" className="text-sm">Mis solicitudes</TabsTrigger>
                    </TabsList>

                    <TabsContent value="order" className="space-y-6">
                        {purchaseResult && (
                            <Card className="mx-auto max-w-xl overflow-hidden border-emerald-200 shadow-sm">
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
                                        <Button variant="outline" className="h-12 w-full sm:w-auto" onClick={copyAllCodes}>
                                            <Copy className="mr-2 size-4" />
                                            Copiar códigos
                                        </Button>
                                    </CardContent>
                                )}
                                <CardFooter className="flex-wrap gap-2 pt-6">
                                    <Button variant="outline" className="h-12" onClick={() => setActiveTab('history')}>
                                        <History className="mr-2 size-4" />
                                        Ver mis solicitudes
                                    </Button>
                                    <Button className="h-12" onClick={handleReset} disabled={pendingResult}>
                                        Nueva compra
                                    </Button>
                                </CardFooter>
                            </Card>
                        )}

                        {!purchaseResult && (
                            <PurchaseWizard
                                key={wizardKey}
                                products={products}
                                productsError={productsError}
                                prices={prices}
                                isPlatform={isPlatform}
                                companies={companies}
                                storesForSelectedCompany={storesForSelectedCompany}
                                targetCompanyId={targetCompanyId}
                                targetStoreId={targetStoreId}
                                onTargetCompanyChange={setTargetCompanyId}
                                onTargetStoreChange={setTargetStoreId}
                                isPurchasing={isPurchasing}
                                onPurchase={handlePurchase}
                            />
                        )}
                    </TabsContent>

                    <TabsContent value="history">
                        <PurchaseHistoryPanel refreshToken={historyTick} />
                    </TabsContent>
                </Tabs>
            </div>
        </main>
    );
}
