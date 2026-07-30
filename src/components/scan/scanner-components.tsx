'use client';

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

interface ActivationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    uuid: string;
    isProcessing: boolean;
}

export function ActivationModal({
    isOpen,
    onClose,
    onConfirm,
    uuid,
    isProcessing,
}: ActivationModalProps) {
    const [confirmationText, setConfirmationText] = useState("");
    const requiredText = "ACTIVAR";
    const isValid = confirmationText.toUpperCase() === requiredText;

    const handleConfirm = () => {
        if (isValid && !isProcessing) {
            onConfirm();
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !isProcessing && !open && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-red-600">
                        <AlertTriangle className="h-5 w-5" />
                        Acción Irreversible
                    </DialogTitle>
                    <DialogDescription className="space-y-2 pt-2 text-left">
                        <p className="font-medium text-gray-900">
                            ¿Estás seguro de activar la tarjeta con ID: <span className="font-mono">{uuid.slice(0, 8)}...</span>?
                        </p>
                        <p className="text-sm text-gray-500">
                            Esta acción no se puede deshacer. Los fondos serán activados y la tarjeta marcada como usada.
                            Verifique que el pago ha sido recibido.
                        </p>
                        <p className="text-sm font-semibold text-gray-700 mt-2">
                            Escribe "{requiredText}" para confirmar:
                        </p>
                    </DialogDescription>
                </DialogHeader>

                <div className="py-2">
                    <Input
                        value={confirmationText}
                        onChange={(e) => setConfirmationText(e.target.value.toUpperCase())}
                        placeholder={requiredText}
                        className="text-center font-bold tracking-widest uppercase"
                        disabled={isProcessing}
                    />
                </div>

                <DialogFooter className="sm:justify-between gap-2 flex-col sm:flex-row">
                    <Button variant="outline" onClick={onClose} disabled={isProcessing} className="w-full sm:w-auto">
                        Cancelar
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleConfirm}
                        disabled={!isValid || isProcessing}
                        className="w-full sm:w-auto font-bold"
                    >
                        {isProcessing ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Procesando
                            </>
                        ) : (
                            "CONFIRMAR ACTIVACIÓN"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export interface ResultData {
    card: {
        uuid: string;
        product: string;
        store: string;
    };
    activation: {
        id: string;
        activatedAt: string;
    };
}

interface ResultCardProps {
    data: ResultData;
    onReset: () => void;
}

export function ResultCard({ data, onReset }: ResultCardProps) {
    return (
        <Card className="w-full max-w-md mx-auto border-green-200 shadow-lg mt-8">
            <CardHeader className="bg-green-50 text-center pb-2 rounded-t-lg">
                <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-2">
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                </div>
                <CardTitle className="text-green-700 text-xl">¡Activación Exitosa!</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
                <div className="bg-gray-50 p-4 rounded-lg space-y-3 text-sm border border-gray-100">
                    <div className="flex justify-between items-center border-b pb-2">
                        <span className="text-gray-500">Producto</span>
                        <span className="font-semibold text-gray-900">{data.card.product}</span>
                    </div>
                    <div className="flex justify-between items-center border-b pb-2">
                        <span className="text-gray-500">Tienda</span>
                        <span className="font-medium text-gray-900">{data.card.store}</span>
                    </div>
                    <div className="flex justify-between items-center border-b pb-2">
                        <span className="text-gray-500">ID Tarjeta</span>
                        <span className="font-mono text-gray-700">{data.card.uuid}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-gray-500">Fecha</span>
                        <span className="font-medium text-gray-900">
                            {new Date(data.activation.activatedAt).toLocaleString()}
                        </span>
                    </div>
                </div>

                <div className="text-xs text-center text-gray-400">
                    <span>Ref: {data.activation.id}</span>
                </div>
            </CardContent>
            <CardFooter className="pb-6">
                <Button onClick={onReset} className="w-full h-12 text-lg" size="lg">
                    Escanear Otra Tarjeta
                </Button>
            </CardFooter>
        </Card>
    );
}
