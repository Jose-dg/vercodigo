'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ShoppingCart, Check, AlertCircle, Copy, Download } from 'lucide-react';
import { toast } from 'sonner';

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
    const { status: sessionStatus } = useSession();
    const [products, setProducts] = useState<Product[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [productsError, setProductsError] = useState<string | null>(null);

    const [selectedProductId, setSelectedProductId] = useState('');
    const [selectedDenominationId, setSelectedDenominationId] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [isPurchasing, setIsPurchasing] = useState(false);
    const [prices, setPrices] = useState<PriceRow[]>([]);

    const [purchaseResult, setPurchaseResult] = useState<PurchaseResponse | null>(null);
    const purchaseAttemptId = useRef<string | null>(null);
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
                    toast.success("¡Códigos entregados!");
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
                        ? 'Diem rechazó la API key. Para local usa DIEM_API_URL=http://localhost:8000 con una key generada en esa instancia; en producción genera una key nueva en diem-ai.onrender.com.'
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

        setIsPurchasing(true);
        try {
            purchaseAttemptId.current ??= crypto.randomUUID();
            const res = await fetch('/api/codes/purchase', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Idempotency-Key': purchaseAttemptId.current,
                },
                body: JSON.stringify({
                    productId: selectedProductId,
                    denominationId: effectiveDenominationId || undefined,
                    count: quantity
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                if (res.status === 409) {
                    toast.error(data.message || "Stock insuficiente");
                } else {
                    toast.error(data.message || "Error al realizar la compra");
                }
                return;
            }

            setPurchaseResult(data);
            toast.success(
                data.purchase?.status === 'COMPLETED'
                    ? "¡Compra exitosa!"
                    : "Solicitud recibida. Estamos asignando tus códigos.",
            );
        } catch (error) {
            console.error("Purchase error:", error);
            toast.error("Error de conexión");
        } finally {
            setIsPurchasing(false);
        }
    };

    const handleReset = () => {
        setPurchaseResult(null);
        setQuantity(1);
        setSelectedProductId('');
        setSelectedDenominationId('');
        purchaseAttemptId.current = null;
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

    if (purchaseResult) {
        const pending = purchaseResult.purchase.isPending;
        const successful = purchaseResult.purchase.isSuccessful;
        const needsAction = purchaseResult.purchase.needsAction;
        const pendingManualReview =
            purchaseResult.purchase.fulfillmentStatus === 'pending_review';
        return (
            <div className="container max-w-2xl py-10">
                <Card className="border-green-200 shadow-lg">
                    <CardHeader className="bg-green-50 rounded-t-lg text-center pb-6">
                        <div className="mx-auto bg-green-100 w-12 h-12 rounded-full flex items-center justify-center mb-4">
                            {pending
                                ? <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
                                : successful
                                    ? <Check className="h-6 w-6 text-green-600" />
                                    : <AlertCircle className="h-6 w-6 text-red-600" />}
                        </div>
                        <CardTitle className="text-2xl text-green-800">
                            {pending
                                ? pendingManualReview
                                    ? 'Confirmación operativa pendiente'
                                    : 'Procesando entrega'
                                : successful
                                    ? '¡Compra Exitosa!'
                                    : needsAction
                                        ? 'Revisión requerida'
                                        : 'Entrega fallida'}
                        </CardTitle>
                        <CardDescription>
                            {pending
                                ? pendingManualReview
                                    ? 'La compra fue recibida. Un administrador confirmará la región o el valor antes de asignar el código.'
                                    : 'Diem está reservando los códigos. Puedes mantener esta pantalla abierta.'
                                : successful
                                    ? `Has adquirido ${purchaseResult.purchase.count} código(s).`
                                    : 'No se debitó la wallet. Un administrador debe revisar la solicitud.'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                        {successful && <div className="bg-gray-50 p-4 rounded-md border max-h-60 overflow-y-auto font-mono text-sm">
                            <ul className="space-y-1 divide-y divide-dashed">
                                {purchaseResult.purchase.keys.map((k, i) => (
                                    <li key={i} className="pt-1 flex justify-between">
                                        <span className="text-gray-500 w-8">{i + 1}.</span>
                                        <span className="font-bold text-gray-800 select-all">{k.code}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>}

                        {successful && <div className="grid grid-cols-2 gap-4">
                            <Button variant="outline" onClick={copyAllCodes} className="w-full">
                                <Copy className="mr-2 h-4 w-4" />
                                Copiar Todos
                            </Button>
                            <Button variant="outline" className="w-full" disabled title="Próximamente">
                                <Download className="mr-2 h-4 w-4" />
                                Descargar TXT
                            </Button>
                        </div>}
                    </CardContent>
                    <CardFooter className="bg-gray-50 rounded-b-lg flex justify-center py-6">
                        <Button onClick={handleReset} size="lg" disabled={pending}>
                            Realizar Nueva Compra
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        );
    }

    return (
        <div className="container max-w-lg py-10">
            <div className="mb-6">
                <h1 className="text-3xl font-bold tracking-tight">Comprar Códigos</h1>
                <p className="text-muted-foreground">Adquiere códigos digitales al instante.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Nueva Orden</CardTitle>
                    <CardDescription>Selecciona el producto y la cantidad.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
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
                            <Label htmlFor="denomination">Denominación</Label>
                            <Select
                                value={selectedDenominationId || undefined}
                                onValueChange={setSelectedDenominationId}
                            >
                                <SelectTrigger id="denomination">
                                    <SelectValue placeholder="Seleccionar denominación..." />
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
                                (Máx. 100)
                            </span>
                        </div>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-md flex gap-3 text-sm text-blue-700 border border-blue-100">
                        <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold mb-1">Entrega gestionada por Diem</p>
                            Diem reservará los códigos y la wallet se debitará únicamente cuando la entrega se complete.
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
        </div>
    );
}
