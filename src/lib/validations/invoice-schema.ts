import { z } from "zod";

export const invoiceItemSchema = z.object({
    description: z.string().min(1, "Description is required"),
    quantity: z.number().int().positive("Quantity must be positive"),
    unitPrice: z.number().min(0, "Unit price must be non-negative"),
    storeId: z.string().optional(),
});

export const createInvoiceSchema = z.object({
    companyId: z.string().min(1, "Company is required"),
    periodStart: z.coerce.date({ message: "Start date is required" }),
    periodEnd: z.coerce.date({ message: "End date is required" }),
    items: z.array(invoiceItemSchema).min(1, "At least one item is required"),
    commissionRate: z.number().min(0).max(1).optional().default(0.05),
});

export const generateInvoiceSchema = z.object({
    companyId: z.string().min(1, "Company is required"),
    periodStart: z.date(),
    periodEnd: z.date(),
    storeIds: z.array(z.string()).optional(), // Optional filter by stores
    activationIds: z.array(z.string()).min(1, "At least one activation must be selected"),
});

export const markAsPaidSchema = z.object({
    invoiceId: z.string().min(1),
    paidAt: z.date().default(() => new Date()),
    notes: z.string().optional(),
    paymentMethod: z.string().optional(),
});

export const cancelInvoiceSchema = z.object({
    invoiceId: z.string().min(1),
    reason: z.string().min(5, "Reason is required"),
});

export type InvoiceItemInput = z.infer<typeof invoiceItemSchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type GenerateInvoiceInput = z.infer<typeof generateInvoiceSchema>;
export type MarkAsPaidInput = z.infer<typeof markAsPaidSchema>;
export type CancelInvoiceInput = z.infer<typeof cancelInvoiceSchema>;
