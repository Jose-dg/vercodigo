"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toggleQRStatus } from "@/app/actions/qr";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Power, PowerOff } from "lucide-react";

interface QRStatusToggleProps {
    id: string;
    isActivated: boolean;
    isRedeemed: boolean;
}

export function QRStatusToggle({ id, isActivated, isRedeemed }: QRStatusToggleProps) {
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const handleToggle = async () => {
        if (isRedeemed) return; // Cannot toggle if redeemed

        setLoading(true);
        try {
            const result = await toggleQRStatus(id, isActivated);
            if (result.success) {
                toast({
                    title: isActivated ? "QR Desactivado" : "QR Activado",
                    description: `El código QR ha sido ${isActivated ? "desactivado" : "activado"} exitosamente.`,
                });
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "No se pudo cambiar el estado del QR.",
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
            variant={isActivated ? "destructive" : "default"}
            size="sm"
            onClick={handleToggle}
            disabled={loading}
            className="h-8 px-2 lg:px-3"
        >
            {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
            ) : isActivated ? (
                <>
                    <PowerOff className="mr-2 h-4 w-4" />
                    Desactivar
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
