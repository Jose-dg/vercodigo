"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Power, CheckCircle2 } from "lucide-react";
import { Prisma } from "@prisma/client";

type QRWithRelations = Prisma.CardGetPayload<{
    include: {
        product: true;
        store: true;
        denomination: true;
        key: true;
    };
}>;

interface QRStatusToggleProps {
    id: string;
    isActivated: boolean;
    isRedeemed: boolean;
    qr: QRWithRelations;
}

export function QRStatusToggle({ isActivated, isRedeemed, qr }: QRStatusToggleProps) {
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const handleToggle = async () => {
        if (isRedeemed) return; // Cannot toggle if redeemed

        setLoading(true);
        try {
            if (isActivated) {
                return;
            }

            const response = await fetch("/api/cards/activate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ qr: qr.uuid }),
            });
            const result = await response.json();
            if (response.ok && result.success) {
                toast({
                    title: result.processing ? "Activación recibida" : "QR activado",
                    description:
                        result.message ??
                        "La tarjeta se activará cuando Diem confirme la asignación del código.",
                });
            } else {
                throw new Error(result.message || result.error);
            }
        } catch (error: unknown) {
            toast({
                variant: "destructive",
                title: "Error",
                description:
                    error instanceof Error
                        ? error.message
                        : "No se pudo cambiar el estado del QR.",
            });
        } finally {
            setLoading(false);
        }
    };

    if (isRedeemed) {
        return null; // Or render a disabled state/badge
    }

    return (
        <Button
            variant={isActivated ? "outline" : "default"}
            size="sm"
            onClick={handleToggle}
            disabled={loading || isActivated}
            className="h-8 px-2 lg:px-3"
        >
            {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
            ) : isActivated ? (
                <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Activado
                </>
            ) : (
                <>
                    <Power className="mr-2 h-4 w-4" />
                    Activar
                </>
            )}
        </Button>
    );
}
