'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { ConfirmActivationModal } from '@/components/activation/ConfirmActivationModal';
import { QRScannerModal } from '@/components/activation/QRScannerModal';
import {
    QrCode,
    Keyboard,
    CheckCircle2,
    XCircle,
    Zap,
    Shield,
    Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type ActivationResult = {
    success: boolean;
    processing?: boolean;
    jobId?: string;
    status?: string;
    activation?: { id: string; activatedAt: string; billingStatus: string };
    card?: { uuid: string; product: string; store: string };
    error?: string;
    message?: string;
};

type CardPreview = {
    uuid: string;
    product: string;
    store: string;
    company: string;
    amount?: number | null;
    currency?: string | null;
    billingAmount?: number | null;
    billingCurrency?: string | null;
    appliedExchangeRate?: number | null;
    canActivate: boolean;
    blockReason?: string | null;
};

const JOB_POLL_MS = 3000;
// Pasado este tiempo se deja de consultar solo; el botón "Consultar Diem" sigue disponible.
const JOB_POLL_LIMIT_MS = 2 * 60_000;

export default function ActivatePage() {
    const [uuid, setUuid] = useState('');
    const [showScanner, setShowScanner] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [result, setResult] = useState<ActivationResult | null>(null);
    const [pendingQr, setPendingQr] = useState('');
    const [cardPreview, setCardPreview] = useState<CardPreview | null>(null);
    const [loading, setLoading] = useState(false);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [pollingStopped, setPollingStopped] = useState(false);
    const resultRef = useRef<HTMLDivElement>(null);

    const busy = loading || previewLoading;

    const loadCardPreview = useCallback(async (qr: string) => {
        setPreviewLoading(true);
        setCardPreview(null);
        setResult(null);
        try {
            const response = await fetch(`/api/cards/preview?qr=${encodeURIComponent(qr)}`, {
                cache: 'no-store',
            });
            const data = await response.json().catch(() => null);
            if (!response.ok || !data) {
                const message = typeof data?.message === 'string'
                    ? data.message
                    : 'No se pudo validar la tarjeta';
                toast.error(message);
                setResult({ success: false, error: data?.error, message });
                return false;
            }
            setCardPreview(data as CardPreview);
            setShowConfirm(true);
            return true;
        } catch {
            toast.error('Error de conexión al validar la tarjeta');
            setResult({
                success: false,
                error: 'NETWORK',
                message: 'Error de conexión al validar la tarjeta. Verifica tu red.',
            });
            return false;
        } finally {
            setPreviewLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!result?.processing || !result.jobId) return;
        setPollingStopped(false);
        const jobId = result.jobId;
        const poll = async () => {
            if (document.visibilityState !== 'visible') return;
            const response = await fetch(`/api/jobs/activation/${jobId}`, { cache: 'no-store' }).catch(() => null);
            const data = await response?.json().catch(() => null);
            if (!response?.ok || !data) return;
            if (data.status === 'COMPLETED') {
                setResult({ ...data, success: true, processing: false });
                toast.success('Tarjeta activada exitosamente');
            } else if (['FAILED', 'ACTION_REQUIRED'].includes(data.status)) {
                setResult({
                    success: false,
                    processing: false,
                    error: data.status,
                    message: data.lastError || 'La activación requiere revisión.',
                });
            }
        };
        const timer = window.setInterval(() => void poll(), JOB_POLL_MS);
        const limit = window.setTimeout(() => {
            window.clearInterval(timer);
            setPollingStopped(true);
        }, JOB_POLL_LIMIT_MS);
        return () => {
            window.clearInterval(timer);
            window.clearTimeout(limit);
        };
    }, [result?.processing, result?.jobId]);

    // En celular el resultado queda bajo las tarjetas: llevarlo a la vista al aparecer.
    useEffect(() => {
        if (!result) return;
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, [result]);

    const handleManualSubmit = async () => {
        if (busy) return;
        const trimmed = uuid.trim();
        if (!trimmed) {
            toast.error('Ingresa un UUID o una URL válida');
            return;
        }
        setPendingQr(trimmed);
        await loadCardPreview(trimmed);
    };

    const retryActivation = async () => {
        if (!result?.jobId) return;
        setLoading(true);
        try {
            const response = await fetch(`/api/jobs/activation/${result.jobId}`, {
                method: 'POST',
                cache: 'no-store',
            });
            const data = await response.json().catch(() => null);
            if (!response.ok || !data) {
                throw new Error(data?.message || 'No se pudo consultar Diem');
            }
            const completed = data.status === 'COMPLETED';
            setResult({ ...data, success: true, processing: !completed });
            toast.success(completed ? 'Tarjeta activada exitosamente' : 'Estado actualizado desde Diem');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'No se pudo consultar Diem');
        } finally {
            setLoading(false);
        }
    };

    const handleScanResult = useCallback((scannedValue: string) => {
        setShowScanner(false);
        setPendingQr(scannedValue);
        void loadCardPreview(scannedValue);
    }, [loadCardPreview]);

    const handleConfirmActivation = async () => {
        setLoading(true);
        setResult(null);
        try {
            const res = await fetch('/api/cards/activate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    qr: pendingQr,
                    quotedAmount: cardPreview?.billingAmount,
                    quotedCurrency: cardPreview?.billingCurrency,
                    quotedRate: cardPreview?.appliedExchangeRate,
                }),
            });

            const data = await res.json();

            if (res.ok && data.success) {
                setResult(data);
                toast.success(
                    data.processing
                        ? 'Activación recibida. Estamos asignando el código.'
                        : 'Tarjeta activada exitosamente',
                );
                setUuid('');
            } else {
                setResult({
                    success: false,
                    error: data.error,
                    message: data.message || 'Error desconocido',
                });
                toast.error(data.message || 'Error al activar');
            }
        } catch {
            setResult({
                success: false,
                error: 'NETWORK',
                message: 'Error de conexión. Verifica tu red.',
            });
            toast.error('Error de conexión');
        } finally {
            setLoading(false);
            setShowConfirm(false);
            setPendingQr('');
            setCardPreview(null);
        }
    };

    const reset = () => {
        setResult(null);
        setUuid('');
        setPendingQr('');
        setCardPreview(null);
    };

    const openScanner = () => {
        if (!busy) setShowScanner(true);
    };

    const tone = result?.processing ? 'processing' : result?.success ? 'success' : 'error';

    return (
        <>
            <div className="flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
                <div>
                    <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-foreground">
                        <Zap className="h-8 w-8 text-amber-500" aria-hidden="true" />
                        Activar tarjeta
                    </h1>
                    <p className="mt-2 text-muted-foreground">
                        Escanea el QR o ingresa el UUID manualmente para activar una tarjeta física.
                    </p>
                </div>

                <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
                    <Shield className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
                    <div>
                        <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Acción irreversible</p>
                        <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300">
                            La activación genera un cargo facturable. Verifica la tarjeta antes de confirmar.
                        </p>
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    {/* Toda la tarjeta abre la cámara: es el objetivo de toque más grande en el celular. */}
                    <Card
                        role="button"
                        tabIndex={busy ? -1 : 0}
                        aria-disabled={busy}
                        aria-label="Escanear QR con la cámara"
                        className={cn(
                            'cursor-pointer border-2 border-dashed transition-colors hover:border-blue-300',
                            busy && 'pointer-events-none opacity-60',
                        )}
                        onClick={openScanner}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                openScanner();
                            }
                        }}
                    >
                        <CardHeader className="pb-2 text-center">
                            <div className="mx-auto mb-2 w-fit rounded-full bg-blue-50 p-4 dark:bg-blue-500/15">
                                <QrCode className="h-8 w-8 text-blue-600" aria-hidden="true" />
                            </div>
                            <CardTitle className="text-lg">Escanear QR</CardTitle>
                            <CardDescription>Usa la cámara del dispositivo</CardDescription>
                        </CardHeader>
                        <CardContent className="text-center">
                            <Button variant="outline" className="w-full" tabIndex={-1} aria-hidden="true">
                                <QrCode className="mr-2 h-4 w-4" />
                                Abrir cámara
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="border-2">
                        <CardHeader className="pb-2 text-center">
                            <div className="mx-auto mb-2 w-fit rounded-full bg-muted/40 p-4">
                                <Keyboard className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
                            </div>
                            <CardTitle className="text-lg">UUID manual</CardTitle>
                            <CardDescription>Ingresa el código de la tarjeta</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                <div className="space-y-1.5">
                                    <Label htmlFor="card-uuid" className="text-xs">
                                        UUID o URL del QR
                                    </Label>
                                    <Input
                                        id="card-uuid"
                                        value={uuid}
                                        onChange={(e) => setUuid(e.target.value)}
                                        placeholder="ej: abc123 o https://..."
                                        className="font-mono text-sm"
                                        autoCapitalize="off"
                                        autoCorrect="off"
                                        spellCheck={false}
                                        disabled={busy}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') void handleManualSubmit();
                                        }}
                                    />
                                </div>
                                <Button
                                    onClick={() => void handleManualSubmit()}
                                    disabled={!uuid.trim() || busy}
                                    className="w-full"
                                >
                                    {busy ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Zap className="mr-2 h-4 w-4" />
                                    )}
                                    {previewLoading ? 'Validando…' : 'Activar'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {previewLoading && (
                    <div
                        role="status"
                        aria-live="polite"
                        className="flex items-center gap-3 rounded-lg border bg-muted/40 p-4 text-sm duration-200 animate-in fade-in-0"
                    >
                        <Loader2 className="h-5 w-5 shrink-0 animate-spin text-blue-600" aria-hidden="true" />
                        <div>
                            <p className="font-medium">Validando tarjeta…</p>
                            <p className="font-mono text-xs text-muted-foreground break-all">{pendingQr}</p>
                        </div>
                    </div>
                )}

                {result && (
                    <Card
                        ref={resultRef}
                        aria-live="polite"
                        className={cn(
                            'scroll-mt-20 border-2 duration-300 animate-in fade-in-0 slide-in-from-bottom-2',
                            tone === 'processing' && 'border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/40',
                            tone === 'success' && 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/40',
                            tone === 'error' && 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40',
                        )}
                    >
                        <CardContent className="pt-6">
                            <div className="flex items-start gap-3">
                                {tone === 'processing' ? (
                                    <Loader2 className="h-6 w-6 shrink-0 animate-spin text-sky-600" aria-hidden="true" />
                                ) : tone === 'success' ? (
                                    <CheckCircle2 className="h-6 w-6 shrink-0 text-green-600" aria-hidden="true" />
                                ) : (
                                    <XCircle className="h-6 w-6 shrink-0 text-red-600" aria-hidden="true" />
                                )}
                                <div className="flex-1 space-y-2">
                                    <p
                                        className={cn(
                                            'font-semibold',
                                            tone === 'processing' && 'text-sky-900 dark:text-sky-200',
                                            tone === 'success' && 'text-green-800 dark:text-green-200',
                                            tone === 'error' && 'text-red-800 dark:text-red-200',
                                        )}
                                    >
                                        {tone === 'processing'
                                            ? 'Activación en proceso'
                                            : tone === 'success'
                                                ? 'Tarjeta activada'
                                                : 'Error de activación'}
                                    </p>

                                    {tone === 'processing' && (
                                        <p className="text-sm text-sky-800 dark:text-sky-300">
                                            {pollingStopped
                                                ? 'Sigue en proceso en Diem. Consulta de nuevo en unos minutos.'
                                                : 'Estamos asignando el código. Esta pantalla se actualiza sola.'}
                                        </p>
                                    )}

                                    {result.success && result.card && (
                                        <div className="space-y-1 text-sm text-green-700 dark:text-green-300">
                                            <p>
                                                <span className="font-medium">Producto:</span> {result.card.product}
                                            </p>
                                            <p>
                                                <span className="font-medium">Tienda:</span> {result.card.store}
                                            </p>
                                            <p>
                                                <span className="font-medium">UUID:</span>{' '}
                                                <span className="font-mono">{result.card.uuid}</span>
                                            </p>
                                            {result.activation && (
                                                <Badge variant="secondary" className="mt-1">
                                                    {result.activation.billingStatus}
                                                </Badge>
                                            )}
                                        </div>
                                    )}

                                    {!result.success && (
                                        <p className="text-sm text-red-600 dark:text-red-300">{result.message}</p>
                                    )}

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={result.processing ? retryActivation : reset}
                                        disabled={loading}
                                        className="mt-3"
                                    >
                                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                                        {loading
                                            ? 'Consultando…'
                                            : result.processing
                                                ? 'Consultar Diem'
                                                : result.success
                                                    ? 'Activar otra tarjeta'
                                                    : 'Intentar de nuevo'}
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            <QRScannerModal
                open={showScanner}
                onClose={() => setShowScanner(false)}
                onScan={handleScanResult}
            />

            <ConfirmActivationModal
                open={showConfirm}
                onClose={() => {
                    setShowConfirm(false);
                    setPendingQr('');
                    setCardPreview(null);
                }}
                onConfirm={handleConfirmActivation}
                cardInfo={cardPreview ?? (pendingQr ? { uuid: pendingQr, canActivate: false } : null)}
            />
        </>
    );
}
