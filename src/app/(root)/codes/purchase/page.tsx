'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { isPlatformRole } from '@/lib/auth/abilities';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ShoppingCart, Check, AlertCircle, Copy, History } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PurchaseHistoryPanel } from '@/components/codes/PurchaseHistoryPanel';

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
        session?.user?.role != null && isPlatformRole(session.user.role as any);
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
                    toast.success("?C?digos entregados!");
                    setHistoryTick((tick) => tick + 1);
                    window.clearInterval(timer);
                } else if (data.purchase.status === 'FAILED') {
                    toast.error("La entrega fall? y no se debit? la wallet.");
                    window.clearInterval(timer);
                } else if (data.purchase.status === 'ACTION_REQUIRED') {
                    toast.error("La entrega necesita revisi?n manual.");
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
            setProductsError('Debes iniciar sesi?n para ver el cat?logo de compra.');
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
                        ? 'Diem rechaz? la API key. Verifica DIEM_SERVICE_API_KEY en .env.local (debe ser la misma que en Vercel).'
                        : rawMessage;
                    setProducts([]);
                    setProductsError(message);
                    toast.error(message);
                    return;
                }

                if (!Array.isArray(data)) {
                    setProducts([]);
                    setProductsError('Respuesta inv?lida del cat?logo de productos.');
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
                        'No hay productos habilitados para compra. Revisa el mapeo con Diem y que est?n activos.',
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
            toast.error("Seleccione la denominaci?n");
            return;
        }
        if (quantity < 1 || quantity > 100) {
            toast.error("Cantidad inv?lida (1-100)");
            return;
        }
        if (isPlatform && !targetCompanyId) {
            toast.error("Selecciona la compa??a que recibir? el cargo");
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
                            ? 'Este intento de compra ya se us? con otra cantidad o producto. Vuelve a confirmar la compra.'
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
                toast.success("Solicitud recibida. Qued? en pendientes por entregar.");
            } else if (data.purchase?.status === 'COMPLETED') {
                setActiveTab('history');
                toast.success("?Compra exitosa!");
            } else {
                toast.error("La solicitud necesita revisi?n.");
            }
        } catch (error) {
            console.error("Purchase error:", error);
            toast.error("Error de conexi?n");
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
        toast.success("C?digos copiados al portapapeles");
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
        <div className="container max-w-5xl py-10">
            <div className="mb-6">
                <h1 className="text-3xl font-bold tracking-tight">Comprar C?digos</h1>
                <p className="text-muted-foreground">
                    Solicita c?digos digitales y consulta entregas pendientes o completadas.
                </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList>
                    <TabsTrigger value="order">Nueva orden</TabsTrigger>
                    <TabsTrigger value="history">Mis solicitudes</TabsTrigger>
                </TabsList>

                <TabsContent value="order" className="space-y-6">
                    {purchaseResult && (
                        <Card className="border-green-200 shadow-sm">
                            <CardHeader className="bg-green-50 rounded-t-lg pb-4">
                                <CardTitle className="text-lg text-green-800 flex items-center gap-2">
                                    {pendingResult
                                        ? <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                                        : successfulResult
                                            ? <Check className="h-5 w-5 text-green-600" />
                                            : <AlertCircle className="h-5 w-5 text-red-600" />}
                                    {pendingResult
                                        ? pendingManualReview
                                            ? 'Confirmaci?n operativa pendiente'
                                            : 'Solicitud en cola'
                                        : successfulResult
                                            ? 'Compra entregada'
                                            : needsActionResult
                                                ? 'Revisi?n requerida'
                                                : 'Entrega fallida'}
                                </CardTitle>
                                <CardDescription>
                                    {pendingResult
                                        ? 'Tu solicitud ya est? registrada. Rev?sala en la pesta?a Mis solicitudes; no necesitas pedirla otra vez.'
                                        : successfulResult
                                            ? `Se entregaron ${purchaseResult.purchase.count} c?digo(s).`
                                            : 'No se debit? la wallet.'}
                                </CardDescription>
                            </CardHeader>
                            {successfulResult && (
                                <CardContent className="pt-4 space-y-4">
                                    <div className="bg-gray-50 p-4 rounded-md border max-h-48 overflow-y-auto font-mono text-sm">
                                        <ul className="space-y-1 divide-y divide-dashed">
                                            {purchaseResult.purchase.keys.map((k, i) => (
                                                <li key={i} className="pt-1 flex justify-between">
                                                    <span className="text-gray-500 w-8">{i + 1}.</span>
                                                    <span className="font-bold text-gray-800 select-all">{k.code}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    <Button variant="outline" onClick={copyAllCodes} className="w-full sm:w-auto">
                                        <Copy className="mr-2 h-4 w-4" />
                                        Copiar c?digos
                                    </Button>
                                </CardContent>
                            )}
                            <CardFooter className="gap-2 flex-wrap">
                                <Button variant="outline" onClick={() => setActiveTab('history')}>
                                    <History className="mr-2 h-4 w-4" />
                                    Ver mis solicitudes
                                </Button>
                                <Button onClick={handleReset} disabled={pendingResult}>
                                    Nueva compra
                                </Button>
                            </CardFooter>
                        </Card>
                    )}

                    <Card className="max-w-lg">
                <CardHeader>
                    <CardTitle>Nueva Orden</CardTitle>
                    <CardDescription>Selecciona el producto y la cantidad.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {isPlatform && (
                        <>
                            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                                Compra en nombre de una compa??a. El cargo se debitar? de su wallet.
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="target-company">Compa??a</Label>
                                <Select
                                    value={targetCompanyId || undefined}
                                    onValueChange={(value) => {
                                        setTargetCompanyId(value);
                                        setTargetStoreId('');
                                    }}
                                >
                                    <SelectTrigger id="target-company">
                                        <SelectValue placeholder="Seleccionar compa??a..." />
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
                                <Label htmlFor="target-store">Tienda (opcional)</Label>
                                <Select
                                    value={targetStoreId || undefined}
                                    onValueChange={setTargetStoreId}
                                    disabled={!targetCompanyId}
                                >
                                    <SelectTrigger id="target-store">
                                        <SelectValue placeholder="Sin tienda espec?fica" />
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
                        </>
                    )}
                    <div className="space-y-2">
                        <Label htmlFor="product">Producto</Label>
                        <Select
                            value={selectedProductId || undefined}
                            onValueChange={(v) => {
                                setSelectedProductId(v);
                                setSelectedDenominationId('');
                            }}
                            disabled={products.length === 0}
                        >
                            <SelectTrigger id="product">
                                <SelectValue placeholder="Seleccionar producto..." />
                            </SelectTrigger>
                            <SelectContent position="popper" className="z-[100]">
                                {products.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                        {p.name} - {p.brand}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {productsError && (
                            <p className="text-sm text-amber-700">{productsError}</p>
                        )}
                    </div>

                    {needsDenomination && (
                        <div className="space-y-2">
                            <Label htmlFor="denomination">Denominaci?n</Label>
                            <Select
                                value={selectedDenominationId || undefined}
                                onValueChange={setSelectedDenominationId}
                            >
                                <SelectTrigger id="denomination">
                                    <SelectValue placeholder="Seleccionar denominaci?n..." />
                                </SelectTrigger>
                                <SelectContent position="popper" className="z-[100]">
                                    {selectedProduct?.denominations.map((d) => (
                                        <SelectItem key={d.id} value={d.id}>
                                            {d.amount} {d.currency}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {referencePrice?.salePrice != null && (
                        <div className="bg-green-50 p-3 rounded-md text-sm text-green-800 border border-green-100">
                            Tu precio de venta configurado:{" "}
                            <span className="font-semibold font-mono">
                                {referencePrice.salePrice.toLocaleString("es-CO")} {referencePrice.currency}
                            </span>{" "}
                            por unidad
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="quantity">Cantidad</Label>
                        <div className="flex items-center gap-4">
                            <Input
                                id="quantity"
                                type="number"
                                min={1}
                                max={100}
                                value={quantity}
                                onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                                className="font-mono text-lg"
                            />
                            <span className="text-sm text-muted-foreground whitespace-nowrap">
                                (M?x. 100)
                            </span>
                        </div>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-md flex gap-3 text-sm text-blue-700 border border-blue-100">
                        <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold mb-1">Entrega gestionada por Diem</p>
                            Diem reservar? los c?digos y la wallet se debitar? ?nicamente cuando la entrega se complete.
                        </div>
                    </div>
                </CardContent>
                <CardFooter>
                    <Button
                        className="w-full"
                        size="lg"
                        onClick={handlePurchase}
                        disabled={isPurchasing || !selectedProductId || (needsDenomination && !selectedDenominationId) || quantity < 1}
                    >
                        {isPurchasing ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Procesando...
                            </>
                        ) : (
                            <>
                                <ShoppingCart className="mr-2 h-4 w-4" />
                                Confirmar Compra
                            </>
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
    );
}
