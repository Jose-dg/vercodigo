'use client';

import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface ConfirmActivationModalProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void>;
    cardInfo: {
        uuid: string;
        product?: string;
        store?: string;
    } | null;
}

export function ConfirmActivationModal({
    open,
    onClose,
    onConfirm,
    cardInfo,
}: ConfirmActivationModalProps) {
    const [confirmText, setConfirmText] = useState('');
    const [loading, setLoading] = useState(false);

    const isValid = confirmText.toUpperCase() === 'ACTIVAR';

    const handleConfirm = async () => {
        if (!isValid) return;
        setLoading(true);
        try {
            await onConfirm();
        } finally {
            setLoading(false);
            setConfirmText('');
        }
    };

    const handleClose = () => {
        setConfirmText('');
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-amber-600">
                        <AlertTriangle className="h-5 w-5" />
                        Confirmar Activación
                    </DialogTitle>
                    <DialogDescription>
                        Esta acción es <strong className="text-red-600">irreversible</strong>. Una vez activada, la tarjeta no se puede desactivar.
                    </DialogDescription>
                </DialogHeader>

                {cardInfo && (
                    <div className="bg-gray-50 rounded-lg p-4 space-y-2 border">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">UUID:</span>
                            <span className="font-mono font-medium">{cardInfo.uuid}</span>
                        </div>
                        {cardInfo.product && (
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Producto:</span>
                                <span className="font-medium">{cardInfo.product}</span>
                            </div>
                        )}
                        {cardInfo.store && (
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Tienda:</span>
                                <span className="font-medium">{cardInfo.store}</span>
                            </div>
                        )}
                    </div>
                )}

                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm font-semibold text-red-800">
                        ⚠️ NO HAY DEVOLUCIONES
                    </p>
                    <p className="text-xs text-red-600 mt-1">
                        Verifica que esta sea la tarjeta correcta antes de continuar.
                    </p>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="confirm-text" className="text-sm font-medium">
                        Escribe <span className="font-mono font-bold text-red-600">ACTIVAR</span> para confirmar:
                    </Label>
                    <Input
                        id="confirm-text"
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        placeholder="Escribe ACTIVAR"
                        className="font-mono uppercase"
                        disabled={loading}
                        autoComplete="off"
                    />
                </div>

                <DialogFooter className="gap-2">
                    <Button
                        variant="outline"
                        onClick={handleClose}
                        disabled={loading}
                    >
                        Cancelar
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleConfirm}
                        disabled={!isValid || loading}
                    >
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Activando...
                            </>
                        ) : (
                            'Confirmar Activación'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
