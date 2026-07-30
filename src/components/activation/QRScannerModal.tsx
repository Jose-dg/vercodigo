'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, CameraOff, AlertCircle } from 'lucide-react';

interface QRScannerModalProps {
    open: boolean;
    onClose: () => void;
    onScan: (result: string) => void;
}

export function QRScannerModal({ open, onClose, onScan }: QRScannerModalProps) {
    const scannerRef = useRef<HTMLDivElement>(null);
    const html5QrCodeRef = useRef<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [isStarting, setIsStarting] = useState(false);

    const stopScanner = useCallback(async () => {
        if (html5QrCodeRef.current) {
            try {
                const state = html5QrCodeRef.current.getState();
                // State 2 = SCANNING
                if (state === 2) {
                    await html5QrCodeRef.current.stop();
                }
            } catch {
                // ignore errors on stop
            }
            html5QrCodeRef.current = null;
        }
    }, []);

    useEffect(() => {
        if (!open) {
            stopScanner();
            return;
        }

        let mounted = true;

        const startScanner = async () => {
            setIsStarting(true);
            setError(null);

            try {
                // Dynamic import to avoid SSR issues
                const { Html5Qrcode } = await import('html5-qrcode');

                if (!mounted || !scannerRef.current) return;

                const scannerId = 'qr-scanner-region';

                // Ensure region element exists
                if (!document.getElementById(scannerId)) {
                    const div = document.createElement('div');
                    div.id = scannerId;
                    scannerRef.current.appendChild(div);
                }

                const scanner = new Html5Qrcode(scannerId);
                html5QrCodeRef.current = scanner;

                await scanner.start(
                    { facingMode: 'environment' },
                    {
                        fps: 10,
                        qrbox: { width: 250, height: 250 },
                        aspectRatio: 1,
                    },
                    (decodedText: string) => {
                        onScan(decodedText);
                        stopScanner();
                    },
                    () => {
                        // QR code scan failure — normal, keeps scanning
                    }
                );
            } catch (err) {
                if (mounted) {
                    const msg =
                        err instanceof Error ? err.message : 'Error desconocido';
                    if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
                        setError(
                            'Permiso de cámara denegado. Habilita el acceso a la cámara en la configuración de tu navegador.'
                        );
                    } else if (msg.includes('NotFoundError')) {
                        setError('No se encontró ninguna cámara en este dispositivo.');
                    } else {
                        setError(`Error al iniciar la cámara: ${msg}`);
                    }
                }
            } finally {
                if (mounted) setIsStarting(false);
            }
        };

        // Small delay to allow dialog to render
        const timeout = setTimeout(startScanner, 300);

        return () => {
            mounted = false;
            clearTimeout(timeout);
            stopScanner();
        };
    }, [open, onScan, stopScanner]);

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Camera className="h-5 w-5" />
                        Escanear QR
                    </DialogTitle>
                    <DialogDescription>
                        Apunta la cámara al código QR de la tarjeta para activarla.
                    </DialogDescription>
                </DialogHeader>

                <div className="relative w-full">
                    {isStarting && (
                        <div className="flex flex-col items-center justify-center h-64 bg-gray-100 rounded-lg">
                            <Camera className="h-10 w-10 text-gray-400 animate-pulse mb-2" />
                            <p className="text-sm text-gray-500">Iniciando cámara...</p>
                        </div>
                    )}

                    {error && (
                        <div className="flex flex-col items-center justify-center h-64 bg-red-50 rounded-lg p-4 text-center">
                            <CameraOff className="h-10 w-10 text-red-400 mb-2" />
                            <p className="text-sm text-red-600">{error}</p>
                        </div>
                    )}

                    <div
                        ref={scannerRef}
                        className={`w-full rounded-lg overflow-hidden ${isStarting || error ? 'hidden' : ''}`}
                    />
                </div>

                <Button variant="outline" onClick={onClose} className="w-full">
                    Cancelar
                </Button>
            </DialogContent>
        </Dialog>
    );
}
