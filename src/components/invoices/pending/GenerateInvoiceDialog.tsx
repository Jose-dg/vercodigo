"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CurrencyDisplay } from "../shared/CurrencyDisplay";
import { generateInvoice } from "@/lib/actions/invoices";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface GenerateInvoiceDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    activationIds: string[];
    companyName: string;
    totalAmount: number;
    periodStart: Date;
    periodEnd: Date;
    companyId: string;
}

export function GenerateInvoiceDialog({
    open,
    onOpenChange,
    activationIds,
    companyName,
    totalAmount,
    periodStart,
    periodEnd,
    companyId,
}: GenerateInvoiceDialogProps) {
    const [isGenerating, setIsGenerating] = useState(false);
    const router = useRouter();

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            const result = await generateInvoice({
                companyId,
                periodStart,
                periodEnd,
                activationIds,
            });

            if (result.success) {
                toast.success("Factura generada exitosamente");
                onOpenChange(false);
                router.push(`/invoices/${result.invoiceId}`);
                router.refresh();
            } else {
                toast.error(result.error || "Error al generar factura");
            }
        } catch (error) {
            toast.error("Error inesperado al generar factura");
            console.error(error);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Generar Factura</DialogTitle>
                    <DialogDescription>
                        Confirma la generación de la factura para {companyName}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Empresa:</span>
                            <span className="font-medium">{companyName}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Activaciones:</span>
                            <span className="font-medium">{activationIds.length} QRs</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Total a Facturar:</span>
                            <span className="font-bold text-lg">
                                <CurrencyDisplay amount={totalAmount} />
                            </span>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isGenerating}
                    >
                        Cancelar
                    </Button>
                    <Button onClick={handleGenerate} disabled={isGenerating}>
                        {isGenerating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Generar Factura
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
