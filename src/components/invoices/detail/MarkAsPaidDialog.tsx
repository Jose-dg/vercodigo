"use client";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { markInvoiceAsPaid } from "@/lib/actions/invoices";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface MarkAsPaidDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    invoiceId: string;
    invoiceNumber: string;
}

export function MarkAsPaidDialog({
    open,
    onOpenChange,
    invoiceId,
    invoiceNumber,
}: MarkAsPaidDialogProps) {
    const [isProcessing, setIsProcessing] = useState(false);
    const router = useRouter();

    const handleMarkAsPaid = async () => {
        setIsProcessing(true);
        try {
            const result = await markInvoiceAsPaid({
                invoiceId,
                paidAt: new Date(),
            });

            if (result.success) {
                toast.success("Factura marcada como pagada");
                onOpenChange(false);
                router.refresh();
            } else {
                toast.error(result.error || "Error al marcar como pagada");
            }
        } catch (error) {
            toast.error("Error inesperado");
            console.error(error);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Marcar como Pagada</DialogTitle>
                    <DialogDescription>
                        ¿Confirmas que la factura {invoiceNumber} ha sido pagada?
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    <p className="text-sm text-muted-foreground">
                        Esta acción actualizará el estado de la factura y todas las
                        activaciones asociadas a PAID.
                    </p>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isProcessing}
                    >
                        Cancelar
                    </Button>
                    <Button onClick={handleMarkAsPaid} disabled={isProcessing}>
                        {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Confirmar Pago
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
