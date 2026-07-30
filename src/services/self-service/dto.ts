import { z } from "zod";

/**
 * Schema de validación para el endpoint POST /api/cards/activate
 */
export const ActivateCardBody = z.object({
    qr: z
        .string()
        .min(1, "El campo QR es requerido")
        .max(2048, "Payload QR demasiado largo"),
    deviceId: z.string().max(255).optional(),
});

export type ActivateCardInput = z.infer<typeof ActivateCardBody>;
