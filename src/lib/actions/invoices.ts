"use server";

import prisma from "@/lib/prisma";
import { ActivationBillingStatus, InvoiceStatus } from "@prisma/client";
import {
    createInvoiceSchema,
    generateInvoiceSchema,
    markAsPaidSchema,
    cancelInvoiceSchema,
    type CreateInvoiceInput,
    type GenerateInvoiceInput,
    type MarkAsPaidInput,
    type CancelInvoiceInput,
} from "@/lib/validations/invoice-schema";
import { revalidatePath } from "next/cache";

// Generate invoice number (simple implementation)
async function generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await prisma.invoice.count({
        where: {
            invoiceNumber: {
                startsWith: `INV-${year}-`,
            },
        },
    });
    const nextNumber = (count + 1).toString().padStart(4, "0");
    return `INV-${year}-${nextNumber}`;
}

export async function generateInvoice(input: GenerateInvoiceInput) {
    try {
        const validated = generateInvoiceSchema.parse(input);

        // Fetch activations
        const activations = await prisma.cardActivation.findMany({
            where: {
                id: { in: validated.activationIds },
                billingStatus: ActivationBillingStatus.PENDING,
            },
            include: {
                store: true,
                card: {
                    include: {
                        product: true,
                        denomination: true,
                    },
                },
            },
        });

        if (activations.length === 0) {
            return { success: false, error: "No valid pending activations found" };
        }

        // Get company details
        const company = await prisma.company.findUnique({
            where: { id: validated.companyId },
        });

        if (!company) {
            return { success: false, error: "Company not found" };
        }

        // Calculate totals and group by store/product
        const itemsMap = new Map<
            string,
            {
                storeId: string;
                storeName: string;
                productName: string;
                amount: number;
                quantity: number;
            }
        >();

        let totalSales = 0;
        let commissionAmount = 0;

        for (const activation of activations) {
            const key = `${activation.storeId}-${activation.card.productId}-${activation.activationAmount}`;
            const existing = itemsMap.get(key);

            if (existing) {
                existing.quantity += 1;
            } else {
                itemsMap.set(key, {
                    storeId: activation.storeId,
                    storeName: activation.store.name,
                    productName: activation.card.product.name,
                    amount: activation.activationAmount,
                    quantity: 1,
                });
            }

            totalSales += activation.activationAmount;
            commissionAmount += activation.commissionAmount || 0;
        }

        const invoiceNumber = await generateInvoiceNumber();

        // Create invoice with items
        const invoice = await prisma.invoice.create({
            data: {
                invoiceNumber,
                companyId: validated.companyId,
                periodStart: validated.periodStart,
                periodEnd: validated.periodEnd,
                totalSales,
                commissionRate: company.commissionRate,
                commissionAmount,
                totalAmount: totalSales - commissionAmount,
                status: InvoiceStatus.PENDING,
                items: {
                    create: Array.from(itemsMap.values()).map((item) => {
                        const totalPrice = item.amount * item.quantity;
                        return {
                            storeId: item.storeId,
                            description: `${item.productName} - $${item.amount} - ${item.storeName}`,
                            quantity: item.quantity,
                            unitPrice: item.amount,
                            totalPrice,
                        };
                    }),
                },
            },
            include: {
                items: true,
            },
        });

        // Update activations
        await prisma.cardActivation.updateMany({
            where: {
                id: { in: validated.activationIds },
            },
            data: {
                billingStatus: ActivationBillingStatus.INVOICED,
                invoiceId: invoice.id,
            },
        });

        revalidatePath("/invoices");
        revalidatePath("/invoices/pending-activations");

        return { success: true, invoiceId: invoice.id };
    } catch (error) {
        console.error("Error generating invoice:", error);
        return { success: false, error: "Failed to generate invoice" };
    }
}

export async function getAvailableCardsAction(filters: {
    productId?: string;
    denominationId?: string;
    storeId?: string;
}) {
    try {
        const cards = await prisma.card.findMany({
            where: {
                isActivated: false,
                ...(filters.productId && { productId: filters.productId }),
                // If denominationId is provided and not "all", try to filter by it.
                // But since many cards have null denominationId, we might need to be careful.
                ...(filters.denominationId && filters.denominationId !== "all" && filters.denominationId !== "" && {
                    OR: [
                        { denominationId: filters.denominationId },
                        { denominationId: null } // Fallback to show cards without denomination if they match the product
                    ]
                }),
                ...(filters.storeId && { storeId: filters.storeId }),
            },
            include: {
                product: true,
                denomination: true,
            },
            orderBy: { createdAt: "desc" },
            take: 50,
        });
        return { success: true, cards };
    } catch (error) {
        console.error("Error fetching available cards:", error);
        return { success: false, error: "Failed to fetch cards" };
    }
}

export async function createInvoice(input: CreateInvoiceInput) {
    try {
        const validated = createInvoiceSchema.parse(input);

        const company = await prisma.company.findUnique({
            where: { id: validated.companyId },
        });

        if (!company) {
            return { success: false, error: "Company not found" };
        }

        const totalSales = validated.items.reduce(
            (sum, item) => sum + item.quantity * item.unitPrice,
            0
        );
        const commissionAmount = totalSales * validated.commissionRate;

        const invoiceNumber = await generateInvoiceNumber();

        const invoice = await prisma.invoice.create({
            data: {
                invoiceNumber,
                companyId: validated.companyId,
                periodStart: validated.periodStart,
                periodEnd: validated.periodEnd,
                totalSales,
                commissionRate: validated.commissionRate,
                commissionAmount,
                totalAmount: totalSales - commissionAmount,
                exchangeRate: validated.exchangeRate,
                status: InvoiceStatus.PENDING,
                items: {
                    create: validated.items.map((item) => ({
                        storeId: item.storeId,
                        cardId: item.cardId,
                        description: item.description,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        totalPrice: item.quantity * item.unitPrice,
                    })),
                },
            },
        });

        revalidatePath("/invoices");

        return { success: true, invoiceId: invoice.id };
    } catch (error) {
        console.error("Error creating invoice:", error);
        return { success: false, error: "Failed to create invoice" };
    }
}

export async function markInvoiceAsPaid(input: MarkAsPaidInput) {
    try {
        const validated = markAsPaidSchema.parse(input);

        const invoice = await prisma.invoice.update({
            where: { id: validated.invoiceId },
            data: {
                status: InvoiceStatus.PAID,
                paidAt: validated.paidAt,
            },
        });

        // Update all activations to PAID
        await prisma.cardActivation.updateMany({
            where: { invoiceId: validated.invoiceId },
            data: {
                billingStatus: ActivationBillingStatus.PAID,
            },
        });

        revalidatePath("/invoices");
        revalidatePath(`/invoices/${validated.invoiceId}`);

        return { success: true, invoice };
    } catch (error) {
        console.error("Error marking invoice as paid:", error);
        return { success: false, error: "Failed to mark invoice as paid" };
    }
}

export async function cancelInvoice(input: CancelInvoiceInput) {
    try {
        const validated = cancelInvoiceSchema.parse(input);

        const invoice = await prisma.invoice.update({
            where: { id: validated.invoiceId },
            data: {
                status: InvoiceStatus.CANCELLED,
            },
        });

        // Revert activations to PENDING
        await prisma.cardActivation.updateMany({
            where: { invoiceId: validated.invoiceId },
            data: {
                billingStatus: ActivationBillingStatus.PENDING,
                invoiceId: null,
            },
        });

        revalidatePath("/invoices");
        revalidatePath(`/invoices/${validated.invoiceId}`);

        return { success: true, invoice };
    } catch (error) {
        console.error("Error cancelling invoice:", error);
        return { success: false, error: "Failed to cancel invoice" };
    }
}

export async function updateInvoiceStatus(
    invoiceId: string,
    status: InvoiceStatus
) {
    try {
        const invoice = await prisma.invoice.update({
            where: { id: invoiceId },
            data: { status },
        });

        revalidatePath("/invoices");
        revalidatePath(`/invoices/${invoiceId}`);

        return { success: true, invoice };
    } catch (error) {
        console.error("Error updating invoice status:", error);
        return { success: false, error: "Failed to update invoice status" };
    }
}
