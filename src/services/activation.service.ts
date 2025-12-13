import prisma from '@/lib/prisma';

export async function getAllActivations(filters?: {
    storeId?: string;
    companyId?: string;
    billingStatus?: 'PENDING' | 'INVOICED' | 'PAID' | 'CANCELLED';
    startDate?: Date;
    endDate?: Date;
}) {
    const where: any = {};

    if (filters?.storeId) {
        where.storeId = filters.storeId;
    }

    if (filters?.companyId) {
        where.store = { companyId: filters.companyId };
    }

    if (filters?.billingStatus) {
        where.billingStatus = filters.billingStatus;
    }

    if (filters?.startDate || filters?.endDate) {
        where.activatedAt = {};
        if (filters.startDate) {
            where.activatedAt.gte = filters.startDate;
        }
        if (filters.endDate) {
            where.activatedAt.lte = filters.endDate;
        }
    }

    return prisma.cardActivation.findMany({
        where,
        include: {
            card: {
                include: {
                    product: true,
                    denomination: true,
                },
            },
            store: {
                include: {
                    company: true,
                },
            },
            invoice: true,
        },
        orderBy: {
            activatedAt: 'desc',
        },
    });
}

export async function getActivationById(id: string) {
    return prisma.cardActivation.findUnique({
        where: { id },
        include: {
            card: {
                include: {
                    product: true,
                    denomination: true,
                    store: {
                        include: {
                            company: true,
                        },
                    },
                },
            },
            store: {
                include: {
                    company: true,
                },
            },
            invoice: true,
        },
    });
}

export async function getActivationStats(filters?: {
    storeId?: string;
    companyId?: string;
    startDate?: Date;
    endDate?: Date;
}) {
    const where: any = {};

    if (filters?.storeId) {
        where.storeId = filters.storeId;
    }

    if (filters?.companyId) {
        where.store = { companyId: filters.companyId };
    }

    if (filters?.startDate || filters?.endDate) {
        where.activatedAt = {};
        if (filters.startDate) {
            where.activatedAt.gte = filters.startDate;
        }
        if (filters.endDate) {
            where.activatedAt.lte = filters.endDate;
        }
    }

    const [
        totalActivations,
        pendingActivations,
        invoicedActivations,
        paidActivations,
        totalRevenue,
        totalCommission,
    ] = await Promise.all([
        prisma.cardActivation.count({ where }),
        prisma.cardActivation.count({ where: { ...where, billingStatus: 'PENDING' } }),
        prisma.cardActivation.count({ where: { ...where, billingStatus: 'INVOICED' } }),
        prisma.cardActivation.count({ where: { ...where, billingStatus: 'PAID' } }),
        prisma.cardActivation.aggregate({
            where,
            _sum: {
                activationAmount: true,
            },
        }),
        prisma.cardActivation.aggregate({
            where,
            _sum: {
                commissionAmount: true,
            },
        }),
    ]);

    return {
        totalActivations,
        pendingActivations,
        invoicedActivations,
        paidActivations,
        totalRevenue: totalRevenue._sum.activationAmount || 0,
        totalCommission: totalCommission._sum.commissionAmount || 0,
    };
}

