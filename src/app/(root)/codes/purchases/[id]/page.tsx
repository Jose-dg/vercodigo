'use client';

import { use, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { OrderDetail, type PurchaseDetail } from '@/components/codes/OrderDetail';

const POLL_MS = 3000;

export default function CodePurchaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [purchase, setPurchase] = useState<PurchaseDetail | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [retrying, setRetrying] = useState(false);
    const lastStatus = useRef<string | null>(null);

    const applyPurchase = useCallback((next: PurchaseDetail) => {
        const previous = lastStatus.current;
        lastStatus.current = next.status;
        setPurchase(next);
        // Only announce transitions observed on this screen, not the initial load.
        if (!previous || previous === next.status) return;
        if (next.status === 'COMPLETED') toast.success('Códigos entregados');
        else if (next.status === 'FAILED') toast.error('La entrega falló y no se debitó la wallet.');
        else if (next.status === 'ACTION_REQUIRED') toast.error('La entrega necesita revisión manual.');
    }, []);

    const load = useCallback(async () => {
        const response = await fetch(`/api/codes/purchases/${id}`, { cache: 'no-store' });
        const data = await response.json().catch(() => null);
        if (response.ok && data?.purchase) {
            setError(null);
            applyPurchase(data.purchase);
            return;
        }
        setError(
            response.status === 404
                ? 'No encontramos esta orden o no tienes acceso a ella.'
                : (data?.message ?? 'No se pudo cargar la orden.'),
        );
    }, [id, applyPurchase]);

    useEffect(() => {
        load().catch(() => setError('Error de conexión.'));
    }, [load]);

    const isOpen = purchase != null && !purchase.timeline.isTerminal;
    // ACTION_REQUIRED waits on ops; keep polling so the page reflects the fix.
    useEffect(() => {
        if (!isOpen) return;
        const timer = window.setInterval(() => {
            load().catch(() => undefined);
        }, POLL_MS);
        return () => window.clearInterval(timer);
    }, [isOpen, load]);

    const retry = async () => {
        setRetrying(true);
        try {
            const response = await fetch(`/api/codes/purchases/${id}`, { method: 'POST' });
            const data = await response.json().catch(() => null);
            if (!response.ok) {
                toast.error(data?.message ?? 'No se pudo consultar Diem');
                return;
            }
            // POST returns the base serialization; reload for the enriched detail.
            await load();
        } catch {
            toast.error('Error de conexión');
        } finally {
            setRetrying(false);
        }
    };

    return (
        <main className="min-h-full bg-muted/20">
            <div className="container max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
                <Link
                    href="/codes/purchase?tab=history"
                    className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                    <ChevronLeft className="size-4" />
                    Mis solicitudes
                </Link>

                {error && !purchase && (
                    <p className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">{error}</p>
                )}
                {!error && !purchase && (
                    <div className="flex h-[40vh] items-center justify-center">
                        <Loader2 className="size-8 animate-spin text-primary" />
                    </div>
                )}
                {purchase && (
                    <OrderDetail
                        purchase={purchase}
                        autoRefreshing={isOpen}
                        retrying={retrying}
                        onRetry={retry}
                    />
                )}
            </div>
        </main>
    );
}
