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
    quotedAmount: z.number().positive().optional(),
    quotedCurrency: z.string().min(1).max(12).optional(),
    quotedRate: z.number().positive().nullable().optional(),
});

export type ActivateCardInput = z.infer<typeof ActivateCardBody>;
