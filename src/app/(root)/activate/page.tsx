'use client';

import { useState, useCallback, useEffect } from 'react';
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
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
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

export default function ActivatePage() {
    const [uuid, setUuid] = useState('');
    const [showScanner, setShowScanner] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [result, setResult] = useState<ActivationResult | null>(null);
    const [pendingQr, setPendingQr] = useState<string>('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!result?.processing || !result.jobId) return;
        const timer = window.setInterval(async () => {
            const response = await fetch(`/api/jobs/activation/${result.jobId}`, { cache: 'no-store' });
            const data = await response.json().catch(() => null);
            if (!response.ok || !data) return;
            if (data.status === 'COMPLETED') {
                setResult({ ...data, success: true, processing: false });
                toast.success('¡Tarjeta activada exitosamente!');
                window.clearInterval(timer);
            } else if (['FAILED', 'ACTION_REQUIRED'].includes(data.status)) {
                setResult({
                    success: false,
                    processing: false,
                    error: data.status,
                    message: data.lastError || 'La activación requiere revisión.',
                });
                window.clearInterval(timer);
            }
        }, 3000);
        return () => window.clearInterval(timer);
    }, [result?.processing, result?.jobId]);

    const handleManualSubmit = () => {
        const trimmed = uuid.trim();
        if (!trimmed) {
            toast.error('Ingresa un UUID o URL válida');
            return;
        }
        setPendingQr(trimmed);
        setShowConfirm(true);
    };

    const handleScanResult = useCallback((scannedValue: string) => {
        setShowScanner(false);
        setPendingQr(scannedValue);
        setShowConfirm(true);
    }, []);

    const handleConfirmActivation = async () => {
        setLoading(true);
        setResult(null);
        try {
            const res = await fetch('/api/cards/activate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ qr: pendingQr }),
            });

            const data = await res.json();

            if (res.ok && data.success) {
                setResult(data);
                toast.success(
                    data.processing
                        ? 'Activación recibida. Estamos asignando el código.'
                        : '¡Tarjeta activada exitosamente!',
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
        }
    };

    const reset = () => {
        setResult(null);
        setUuid('');
        setPendingQr('');
    };

    return (
        <>
            <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
                <div className="flex items-center gap-2 px-4">
                    <SidebarTrigger className="-ml-1" />
                    <Separator
                        orientation="vertical"
                        className="mr-2 data-[orientation=vertical]:h-4"
                    />
                    <Breadcrumb>
                        <BreadcrumbList>
                            <BreadcrumbItem className="hidden md:block">
                                <BreadcrumbLink href="/">Inicio</BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator className="hidden md:block" />
                            <BreadcrumbItem className="hidden md:block">
                                <BreadcrumbLink href="/activations">Operaciones</BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator className="hidden md:block" />
                            <BreadcrumbItem>
                                <BreadcrumbPage>Activar Tarjeta</BreadcrumbPage>
                            </BreadcrumbItem>
                        </BreadcrumbList>
                    </Breadcrumb>
                </div>
            </header>

            <div className="flex flex-1 flex-col gap-6 p-4 pt-0 max-w-3xl">
                {/* Page Title */}
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-3">
                        <Zap className="h-8 w-8 text-amber-500" />
                        Activar Tarjeta
                    </h1>
                    <p className="text-gray-500 mt-2">
                        Escanea el QR o ingresa el UUID manualmente para activar una tarjeta física.
                    </p>
                </div>

                {/* Security Notice */}
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <Shield className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                        <p className="text-sm font-semibold text-amber-800">Acción Irreversible</p>
                        <p className="text-xs text-amber-600 mt-0.5">
                            La activación genera un cargo facturable. Verifica la tarjeta antes de confirmar.
                        </p>
                    </div>
                </div>

                {/* Input Methods */}
                <div className="grid sm:grid-cols-2 gap-4">
                    {/* QR Scanner Card */}
                    <Card className="border-2 border-dashed hover:border-blue-300 transition-colors cursor-pointer"
                        onClick={() => setShowScanner(true)}>
                        <CardHeader className="text-center pb-2">
                            <div className="mx-auto bg-blue-50 rounded-full p-4 mb-2 w-fit">
                                <QrCode className="h-8 w-8 text-blue-600" />
                            </div>
                            <CardTitle className="text-lg">Escanear QR</CardTitle>
                            <CardDescription>
                                Usa la cámara del dispositivo
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="text-center">
                            <Button variant="outline" className="w-full">
                                <QrCode className="mr-2 h-4 w-4" />
                                Abrir Cámara
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Manual UUID Card */}
                    <Card className="border-2">
                        <CardHeader className="text-center pb-2">
                            <div className="mx-auto bg-gray-50 rounded-full p-4 mb-2 w-fit">
                                <Keyboard className="h-8 w-8 text-gray-600" />
                            </div>
                            <CardTitle className="text-lg">UUID Manual</CardTitle>
                            <CardDescription>
                                Ingresa el código de la tarjeta
                            </CardDescription>
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
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleManualSubmit();
                                        }}
                                    />
                                </div>
                                <Button
                                    onClick={handleManualSubmit}
                                    disabled={!uuid.trim() || loading}
                                    className="w-full"
                                >
                                    {loading ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Zap className="mr-2 h-4 w-4" />
                                    )}
                                    Activar
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Result Display */}
                {result && (
                    <Card className={`border-2 ${result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                        <CardContent className="pt-6">
                            <div className="flex items-start gap-3">
                                {result.success ? (
                                    <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" />
                                ) : (
                                    <XCircle className="h-6 w-6 text-red-600 shrink-0" />
                                )}
                                <div className="flex-1 space-y-2">
                                    <p className={`font-semibold ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                                        {result.processing
                                            ? 'Activación en proceso'
                                            : result.success
                                                ? '¡Tarjeta Activada!'
                                                : 'Error de Activación'}
                                    </p>

                                    {result.success && result.card && (
                                        <div className="space-y-1 text-sm">
                                            <p className="text-green-700">
                                                <span className="font-medium">Producto:</span> {result.card.product}
                                            </p>
                                            <p className="text-green-700">
                                                <span className="font-medium">Tienda:</span> {result.card.store}
                                            </p>
                                            <p className="text-green-700">
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
                                        <p className="text-sm text-red-600">{result.message}</p>
                                    )}

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={reset}
                                        disabled={result.processing}
                                        className="mt-3"
                                    >
                                            {result.processing
                                                ? 'Procesando…'
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

            {/* Modals */}
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
                }}
                onConfirm={handleConfirmActivation}
                cardInfo={pendingQr ? { uuid: pendingQr } : null}
            />
        </>
    );
}
