'use client';

import { useEffect, useState, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, Camera, Keyboard, Search, ArrowRight } from 'lucide-react';
import { ActivationModal, ResultCard, ResultData } from '@/components/scan/scanner-components';
import { toast } from 'sonner';

export default function ScanPage() {
    const [scanResult, setScanResult] = useState<string | null>(null);
    const [manualUuid, setManualUuid] = useState('');
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [activationResult, setActivationResult] = useState<ResultData | null>(null);
    const scannerRef = useRef<Html5QrcodeScanner | null>(null);

    // Initialize Scanner
    useEffect(() => {
        // Only init if element exists and not already initialized
        const element = document.getElementById('reader');
        if (element && !scannerRef.current && !scanResult && !activationResult) {
            const scanner = new Html5QrcodeScanner(
                'reader',
                {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1.0,
                    showTorchButtonIfSupported: true,
                },
                false
            );

            scanner.render(
                (decodedText) => {
                    handleScan(decodedText);
                },
                (errorMessage) => {
                    // Ignore transient errors
                }
            );

            scannerRef.current = scanner;
        }

        return () => {
            if (scannerRef.current) {
                scannerRef.current.clear().catch(console.error);
                scannerRef.current = null;
            }
        };
    }, [scanResult, activationResult]); // Re-init if they are cleared

    const handleScan = (decodedText: string) => {
        // Simple validation or extraction logic
        // Assuming decodedText is the UUID or a URL containing it
        let uuid = decodedText.trim();

        // Basic URL extraction if needed (adjust based on your QR format)
        try {
            if (uuid.startsWith('http')) {
                const url = new URL(uuid);
                const segments = url.pathname.split('/').filter(Boolean);
                if (segments.length > 0) {
                    uuid = segments[segments.length - 1]; // Assume last part is UUID
                }
            }
        } catch (e) {
            // Not a URL, use as is
        }

        if (uuid) {
            if (scannerRef.current) {
                scannerRef.current.pause(true);
            }
            setScanResult(uuid);
            setIsConfirmOpen(true);
        }
    };

    const handleManualSubmit = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (manualUuid.trim().length < 8) { // Basic check
            toast.error("El código parece muy corto.");
            return;
        }
        setScanResult(manualUuid.trim());
        setIsConfirmOpen(true);
    };

    const handleConfirmActivation = async () => {
        if (!scanResult) return;

        setIsProcessing(true);
        try {
            const res = await fetch('/api/cards/activate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ qr: scanResult }),
            });

            const data = await res.json();

            if (!res.ok) {
                if (res.status === 409) {
                    toast.error("Esta tarjeta ya estaba activada.");
                } else {
                    toast.error(data.message || "Error al activar tarjeta");
                }
                // Don't close modal immediately on error? Or maybe yes to let them retry?
                // For now, close modal and keep input
                setIsConfirmOpen(false);
                if (scannerRef.current) scannerRef.current.resume();
            } else {
                toast.success("¡Tarjeta activada exitosamente!");
                setActivationResult(data); // { success, activation, card }
                setIsConfirmOpen(false);
                if (scannerRef.current) scannerRef.current.clear();
            }
        } catch (error) {
            console.error("Error activating:", error);
            toast.error("Error de conexión. Intente nuevamente.");
            setIsConfirmOpen(false);
            if (scannerRef.current) scannerRef.current.resume();
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReset = () => {
        setScanResult(null);
        setActivationResult(null);
        setManualUuid('');
        setIsConfirmOpen(false);
        // Effect will re-init scanner
    };

    const handleModalClose = () => {
        setIsConfirmOpen(false);
        setScanResult(null);
        if (scannerRef.current) {
            scannerRef.current.resume();
        }
    };


    // If successful activation, show result
    if (activationResult) {
        return (
            <div className="min-h-screen bg-gray-50 p-4 flex flex-col items-center justify-center">
                <ResultCard data={activationResult} onReset={handleReset} />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center py-10 px-4">
            <div className="w-full max-w-md space-y-8">
                <div className="text-center">
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">Activación de Tarjetas</h1>
                    <p className="mt-2 text-sm text-gray-600">
                        Escanea el código QR de la tarjeta o ingresa el ID manualmente.
                    </p>
                </div>

                <Tabs defaultValue="scan" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-4">
                        <TabsTrigger value="scan" className="flex items-center gap-2">
                            <Camera className="w-4 h-4" /> Escáner
                        </TabsTrigger>
                        <TabsTrigger value="manual" className="flex items-center gap-2">
                            <Keyboard className="w-4 h-4" /> Manual
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="scan">
                        <Card className="overflow-hidden">
                            <CardContent className="p-0">
                                {/* HTML5-QRCode Scanner Container */}
                                <div id="reader" className="w-full bg-black min-h-[300px]"></div>
                                <div className="p-4 bg-white text-center text-sm text-gray-500 border-t">
                                    Apunta la cámara al código QR
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="manual">
                        <Card>
                            <CardHeader>
                                <CardTitle>Ingreso Manual</CardTitle>
                                <CardDescription>
                                    Escribe el ID único o el código impreso en la tarjeta.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleManualSubmit} className="space-y-4">
                                    <div className="space-y-2">
                                        <Input
                                            placeholder="Ej: a1b2c3d4..."
                                            value={manualUuid}
                                            onChange={(e) => setManualUuid(e.target.value)}
                                            className="font-mono text-center tracking-wide"
                                        />
                                    </div>
                                    <Button type="submit" className="w-full" disabled={!manualUuid.trim()}>
                                        Verificar <ArrowRight className="ml-2 w-4 h-4" />
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
                    <div className="text-sm text-blue-800">
                        <p className="font-semibold mb-1">Nota importante:</p>
                        <ul className="list-disc list-inside space-y-1">
                            <li>Solo activa tarjetas si el cliente ya pagó.</li>
                            <li>La activación es irreversible.</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Modal de Confirmación */}
            {scanResult && (
                <ActivationModal
                    isOpen={isConfirmOpen}
                    onClose={handleModalClose}
                    onConfirm={handleConfirmActivation}
                    uuid={scanResult}
                    isProcessing={isProcessing}
                />
            )}
        </div>
    );
}
