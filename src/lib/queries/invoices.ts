import prisma from "@/lib/prisma";
import { ActivationBillingStatus, InvoiceStatus, Prisma } from "@prisma/client";

export async function getInvoiceStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
        totalPending,
        totalOverdue,
        activationsPending,
        commissionsMonth
    ] = await Promise.all([
        // Total Pending Amount (Invoiced but not paid)
        prisma.invoice.aggregate({
            _sum: { totalAmount: true },
            where: { status: InvoiceStatus.PENDING }
        }),
        // Total Overdue Amount
        prisma.invoice.aggregate({
            _sum: { totalAmount: true },
            where: { status: InvoiceStatus.OVERDUE }
        }),
        // Pending Activations Amount (Not yet invoiced)
        prisma.cardActivation.aggregate({
            _sum: { activationAmount: true },
            where: { billingStatus: ActivationBillingStatus.PENDING }
        }),
        // Commissions this month (from paid invoices or just created?)
        // Let's count commissions from invoices created this month
        prisma.invoice.aggregate({
            _sum: { commissionAmount: true },
            where: {
                createdAt: { gte: startOfMonth }
            }
        })
    ]);

    return {
        totalPending: totalPending._sum.totalAmount || 0,
        totalOverdue: totalOverdue._sum.totalAmount || 0,
        activationsPending: activationsPending._sum.activationAmount || 0,
        commissionsMonth: commissionsMonth._sum.commissionAmount || 0
    };
}

export type InvoiceFilters = {
    status?: InvoiceStatus;
    companyId?: string;
    dateRange?: { from: Date; to: Date };
    page?: number;
    pageSize?: number;
};

export async function getInvoices({ status, companyId, dateRange, page = 1, pageSize = 10 }: InvoiceFilters) {
    const where: Prisma.InvoiceWhereInput = {
        ...(status && { status }),
        ...(companyId && { companyId }),
        ...(dateRange && {
            createdAt: {
                gte: dateRange.from,
                lte: dateRange.to
            }
        })
    };

    const [invoices, total] = await Promise.all([
        prisma.invoice.findMany({
            where,
            include: { company: true },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * pageSize,
            take: pageSize
        }),
        prisma.invoice.count({ where })
    ]);

    return { invoices, total, totalPages: Math.ceil(total / pageSize) };
}

export async function getInvoiceById(id: string) {
    return prisma.invoice.findUnique({
        where: { id },
        include: {
            company: true,
            items: {
                include: { store: true }
            },
            CardActivation: {
                include: {
                    store: true,
                    card: {
                        include: { product: true }
                    }
                }
            }
        }
    });
}

export async function getPendingActivations(filters?: {
    companyId?: string;
    storeId?: string;
    dateRange?: { from: Date; to: Date };
}) {
    const where: Prisma.CardActivationWhereInput = {
        billingStatus: ActivationBillingStatus.PENDING,
        ...(filters?.companyId && { store: { companyId: filters.companyId } }),
        ...(filters?.storeId && { storeId: filters.storeId }),
        ...(filters?.dateRange && {
            activatedAt: {
                gte: filters.dateRange.from,
                lte: filters.dateRange.to
            }
        })
    };

    const activations = await prisma.cardActivation.findMany({
        where,
        include: {
            store: {
                include: { company: true }
            },
            card: {
                include: {
                    product: true,
                    denomination: true
                }
            }
        },
        orderBy: { activatedAt: 'asc' }
    });


    return activations;
}

// Helper queries for invoice form
export async function getAllCompanies() {
    return prisma.company.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
    });
}

export async function getStoresByCompany(companyId: string) {
    return prisma.store.findMany({
        where: { companyId, isActive: true },
        orderBy: { name: "asc" },
    });
}

export async function getAllProducts() {
    return prisma.product.findMany({
        where: { isActive: true },
        include: {
            denominations: true,
        },
        orderBy: { name: "asc" },
    });
}

// Get available cards for invoicing (not yet activated or invoiced)
export async function getAvailableCardsForInvoicing(filters?: {
    productId?: string;
    denominationId?: string;
    storeId?: string;
}) {
    return prisma.card.findMany({
        where: {
            isActivated: false, // Only non-activated cards
            ...(filters?.productId && { productId: filters.productId }),
            ...(filters?.denominationId && { denominationId: filters.denominationId }),
            ...(filters?.storeId && { storeId: filters.storeId }),
        },
        include: {
            product: true,
            denomination: true,
            store: true,
        },
        orderBy: { createdAt: "desc" },
        take: 100, // Limit for performance
    });
}

// Get card count by product and denomination
export async function getCardInventoryCount(filters: {
    productId: string;
    denominationId?: string;
}) {
    return prisma.card.count({
        where: {
            productId: filters.productId,
            isActivated: false,
            ...(filters.denominationId && { denominationId: filters.denominationId }),
        },
    });
}
