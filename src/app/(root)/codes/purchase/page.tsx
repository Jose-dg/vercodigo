'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { isPlatformRole } from '@/lib/auth/abilities';
import { ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PurchaseHistoryPanel } from '@/components/codes/PurchaseHistoryPanel';
import { PurchaseWizard, type PriceRow, type PricesStatus, type WalletBalance } from '@/components/codes/PurchaseWizard';
import { PurchaseWizardSkeleton } from '@/components/codes/PurchaseWizardSkeleton';
import { startNavigationProgress } from '@/components/navigation-progress';
import type { CatalogProduct } from '@/lib/codes/catalog-regions';
import type { UserRole } from '@prisma/client';

export default function PurchaseCodesPage() {
    const router = useRouter();
    const { status: sessionStatus } = useSession();
    const [effectiveRole, setEffectiveRole] = useState<UserRole | null>(null);
    // Hasta conocer el rol no se cotiza: plataforma necesita una empresa elegida y una
    // cotización sin ella respondería 400.
    const [roleResolved, setRoleResolved] = useState(false);
    const isPlatform = effectiveRole != null && isPlatformRole(effectiveRole);
    const [products, setProducts] = useState<CatalogProduct[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [productsError, setProductsError] = useState<string | null>(null);

    const [isPurchasing, setIsPurchasing] = useState(false);
    const [prices, setPrices] = useState<PriceRow[]>([]);
    // Sin esto, mientras llegan las cotizaciones el checkout decía "sin costo configurado".
    const [pricesStatus, setPricesStatus] = useState<PricesStatus>('loading');
    const [pricesReloadToken, setPricesReloadToken] = useState(0);

    const [activeTab, setActiveTab] = useState('order');
    const [historyTick, setHistoryTick] = useState(0);
    const purchaseInFlightKey = useRef<string | null>(null);
    const [targetCompanyId, setTargetCompanyId] = useState('');
    const [targetStoreId, setTargetStoreId] = useState('');
    const [targetOriginPhoneId, setTargetOriginPhoneId] = useState('');
    const [originPhones, setOriginPhones] = useState<{ id: string; phone: string; label: string }[]>([]);
    const [companies, setCompanies] = useState<
        { companyId: string; companyName: string; balance: number; currency: string }[]
    >([]);
    const [companyBalance, setCompanyBalance] = useState<WalletBalance | null>(null);
    const [platformStores, setPlatformStores] = useState<
        { id: string; name: string; companyId: string }[]
    >([]);
    // Back-link from an order detail opens the history tab (?tab=history).
    useEffect(() => {
        if (new URLSearchParams(window.location.search).get('tab') === 'history') {
            setActiveTab('history');
        }
    }, []);

    useEffect(() => {
        if (sessionStatus !== 'authenticated') {
            return;
        }
        let cancelled = false;
        fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' })
            .then(async (response) => {
                if (!response.ok) throw new Error('No se pudo validar el usuario');
                return response.json();
            })
            .then((data) => {
                const role = data.user?.role;
                if (!cancelled) {
                    setEffectiveRole(typeof role === 'string' ? role as UserRole : null);
                    setRoleResolved(true);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setEffectiveRole(null);
                    setRoleResolved(true);
                }
            });
        return () => { cancelled = true; };
    }, [sessionStatus]);

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

        return () => {
            cancelled = true;
        };
    }, [sessionStatus]);

    useEffect(() => {
        if (!effectiveRole || isPlatform) return;
        fetch('/api/wallets', { credentials: 'include' })
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (data?.wallet && typeof data.wallet.balance === 'number') {
                    setCompanyBalance({ amount: data.wallet.balance, currency: data.wallet.currency });
                }
            })
            .catch(() => undefined);
    }, [effectiveRole, isPlatform]);

    useEffect(() => {
        if (sessionStatus !== 'authenticated' || !roleResolved) return;
        if (isPlatform && !targetCompanyId) {
            setPrices([]);
            setPricesStatus('idle');
            return;
        }
        // Al cambiar de empresa rápido, solo la última cotización puede escribir.
        let cancelled = false;
        setPricesStatus('loading');
        const query = isPlatform
            ? `?companyId=${encodeURIComponent(targetCompanyId)}`
            : '';
        fetch(`/api/codes/quotes${query}`, { credentials: 'include', cache: 'no-store' })
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then((data) => {
                if (cancelled) return;
                setPrices(Array.isArray(data?.rows) ? data.rows : []);
                setPricesStatus('ready');
            })
            .catch(() => {
                if (cancelled) return;
                setPrices([]);
                setPricesStatus('error');
            });
        return () => {
            cancelled = true;
        };
    }, [sessionStatus, roleResolved, isPlatform, targetCompanyId, pricesReloadToken]);

    useEffect(() => {
        if (!isPlatform) return;
        fetch('/api/wallets', { credentials: 'include' })
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (data?.wallets) {
                    setCompanies(
                        data.wallets.map(
                            (w: { companyId: string; companyName: string; balance: number; currency: string }) => ({
                                companyId: w.companyId,
                                companyName: w.companyName,
                                balance: w.balance,
                                currency: w.currency,
                            }),
                        ),
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

    const selectedCompany = companies.find((c) => c.companyId === targetCompanyId);
    const balance: WalletBalance | null = isPlatform
        ? selectedCompany
            ? { amount: selectedCompany.balance, currency: selectedCompany.currency }
            : null
        : companyBalance;

    const storesForSelectedCompany = platformStores.filter(
        (store) => store.companyId === targetCompanyId,
    );

    useEffect(() => {
        setTargetOriginPhoneId('');
        setOriginPhones([]);
        if (!isPlatform || !targetCompanyId) return;
        fetch(`/api/purchase-origin-phones?companyId=${encodeURIComponent(targetCompanyId)}`)
            .then((res) => (res.ok ? res.json() : []))
            .then((rows) => setOriginPhones(Array.isArray(rows) ? rows : []))
            .catch(() => undefined);
    }, [isPlatform, targetCompanyId]);

    const handlePurchase = async (payload: {
        productId: string;
        denominationId: string | null;
        count: number;
        quotedUnitAmount: number;
        quotedCurrency: string;
        quotedRate?: number | null;
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
        if (isPlatform && !targetStoreId && !targetOriginPhoneId) {
            toast.error('Selecciona una sede o un número de origen');
            return;
        }

        setIsPurchasing(true);
        // Tras una compra exitosa se navega al detalle: el botón sigue bloqueado hasta salir
        // de la página, o un segundo toque crearía otra compra con una idempotency key nueva.
        let leavingPage = false;
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
                    quotedUnitAmount: payload.quotedUnitAmount,
                    quotedCurrency: payload.quotedCurrency,
                    quotedRate: payload.quotedRate,
                    ...(isPlatform
                        ? {
                              companyId: targetCompanyId,
                              origin: targetOriginPhoneId
                                  ? { kind: 'phone', id: targetOriginPhoneId }
                                  : { kind: 'store', id: targetStoreId },
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

            setHistoryTick((tick) => tick + 1);
            if (data.purchase?.status === 'COMPLETED') {
                toast.success('Compra exitosa');
            } else if (data.purchase?.isPending) {
                toast.success('Orden registrada. Te mostramos su estado en vivo.');
            } else {
                toast.error('La solicitud necesita revisión.');
            }
            if (data.purchase?.id) {
                leavingPage = true;
                startNavigationProgress();
                router.push(`/codes/purchases/${data.purchase.id}`);
            }
        } catch (error) {
            console.error('Purchase error:', error);
            toast.error('Error de conexión');
        } finally {
            if (!leavingPage) {
                setIsPurchasing(false);
                purchaseInFlightKey.current = null;
            }
        }
    };

    return (
        <main className="min-h-full bg-muted/20">
            <div className="container max-w-6xl px-4 py-4 sm:px-6 sm:py-10">
                <header className="mb-4 flex items-start gap-4 sm:mb-8">
                    <div className="hidden size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm sm:flex">
                        <ShoppingCart className="size-5" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight sm:text-4xl">Comprar códigos</h1>
                        {/* En celular la frase se omite: cada píxel cuenta para no hacer scroll en el pedido. */}
                        <p className="mt-1 hidden max-w-2xl text-sm leading-relaxed text-muted-foreground sm:block sm:text-base">
                            Elige región, marca y producto paso a paso. Pensado para comprar fácil desde el celular.
                        </p>
                    </div>
                </header>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
                    <TabsList className="grid h-12 w-full max-w-sm grid-cols-2 p-1">
                        <TabsTrigger value="order" className="text-sm">Nueva orden</TabsTrigger>
                        <TabsTrigger value="history" className="text-sm">Mis solicitudes</TabsTrigger>
                    </TabsList>

                    {/* forceMount: cambiar de pestaña no reinicia el wizard ni recarga el historial. */}
                    <TabsContent value="order" forceMount className="space-y-6 data-[state=inactive]:hidden">
                        {loadingProducts ? (
                            <PurchaseWizardSkeleton />
                        ) : (
                            <PurchaseWizard
                                products={products}
                                productsError={productsError}
                                prices={prices}
                                pricesStatus={pricesStatus}
                                onRetryPrices={() => setPricesReloadToken((token) => token + 1)}
                                balance={balance}
                                isPlatform={isPlatform}
                                companies={companies}
                                storesForSelectedCompany={storesForSelectedCompany}
                                targetCompanyId={targetCompanyId}
                                targetStoreId={targetStoreId}
                                onTargetCompanyChange={setTargetCompanyId}
                                onTargetStoreChange={setTargetStoreId}
                                targetOriginPhoneId={targetOriginPhoneId}
                                originPhones={originPhones}
                                onTargetOriginPhoneChange={setTargetOriginPhoneId}
                                isPurchasing={isPurchasing}
                                onPurchase={handlePurchase}
                            />
                        )}
                    </TabsContent>

                    <TabsContent value="history" forceMount className="data-[state=inactive]:hidden">
                        <PurchaseHistoryPanel refreshToken={historyTick} />
                    </TabsContent>
                </Tabs>
            </div>
        </main>
    );
}
