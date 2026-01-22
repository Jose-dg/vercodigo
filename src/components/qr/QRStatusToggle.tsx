"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toggleQRStatus } from "@/app/actions/qr";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Power, PowerOff } from "lucide-react";
import { createOrder, OrderPayload } from "@/lib/api/orders";
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

export function QRStatusToggle({ id, isActivated, isRedeemed, qr }: QRStatusToggleProps) {
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const handleToggle = async () => {
        if (isRedeemed) return; // Cannot toggle if redeemed

        setLoading(true);
        try {
            // If we are activating (current status is false), create order first
            if (!isActivated) {
                const amount = (qr.customAmount ?? qr.denomination?.amount ?? 0).toFixed(2);
                const payload: OrderPayload = {
                    name: qr.uuid,
                    store_id: qr.storeId || "",
                    total_price: amount,
                    customer: {
                        first_name: "Juan",
                        last_name: "Perez",
                        email: "juan.perez@example.com",
                        phone: "+573001234567"
                    },
                    billing_address: {
                        company: "123456789", // CRITICAL: Document ID
                        phone: "+573001234567",
                        address_1: "Calle 123 # 45-67",
                        address_2: "Apto 101",
                        city: "Bogotá",
                        state: "Cundinamarca",
                        postcode: "110111",
                        country: "Colombia"
                    },
                    line_items: [
                        {
                            sku: qr.product?.name || "UNKNOWN",
                            quantity: 1,
                            price: amount,
                            _is_membership: false,
                            _days_membership: 0
                        }
                    ]
                };

                try {
                    await createOrder(payload);
                    toast({
                        title: "Orden Creada",
                        description: "La orden se ha creado exitosamente en el sistema.",
                    });
                } catch (orderError: any) {
                    console.error("Failed to create order:", orderError);
                    toast({
                        variant: "destructive",
                        title: "Error al crear orden",
                        description: orderError.message || "No se pudo crear la orden, pero se intentará activar el QR.",
                    });
                    // Decide if we should stop here or continue to activate.
                    // The user said "Respuestas Esperadas... 400 Bad Request... Mostrar mensaje de error".
                    // If order creation fails, maybe we shouldn't activate?
                    // But the prompt says "Implementa fielmente...".
                    // I'll throw to stop activation if order creation fails, to be safe and consistent.
                    throw new Error("No se pudo crear la orden. La activación ha sido cancelada.");
                }
            }

            const result = await toggleQRStatus(id, isActivated);
            if (result.success) {
                toast({
                    title: isActivated ? "QR Desactivado" : "QR Activado",
                    description: `El código QR ha sido ${isActivated ? "desactivado" : "activado"} exitosamente.`,
                });
            } else {
                throw new Error(result.error);
            }
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Error",
                description: error.message || "No se pudo cambiar el estado del QR.",
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
