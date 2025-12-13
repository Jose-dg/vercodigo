import prisma from '@/lib/prisma';

export async function getAllCompanies() {
    return prisma.company.findMany({
        include: {
            _count: {
                select: {
                    stores: true,
                    users: true,
                    invoices: true,
                },
            },
        },
        orderBy: {
            createdAt: 'desc',
        },
    });
}

export async function getCompanyById(id: string) {
    return prisma.company.findUnique({
        where: { id },
        include: {
            stores: {
                include: {
                    _count: {
                        select: {
                            cards: true,
                            activations: true,
                        },
                    },
                },
            },
            users: true,
            invoices: {
                take: 10,
                orderBy: {
                    createdAt: 'desc',
                },
            },
            _count: {
                select: {
                    stores: true,
                    users: true,
                    invoices: true,
                },
            },
        },
    });
}

export async function getCompanyStats(companyId: string) {
    const [
        totalStores,
        totalUsers,
        totalInvoices,
        totalCards,
        totalActivations,
        totalRevenue,
    ] = await Promise.all([
        prisma.store.count({ where: { companyId } }),
        prisma.user.count({ where: { companyId } }),
        prisma.invoice.count({ where: { companyId } }),
        prisma.card.count({
            where: {
                store: { companyId },
            },
        }),
        prisma.cardActivation.count({
            where: {
                store: { companyId },
            },
        }),
        prisma.invoice.aggregate({
            where: {
                companyId,
                status: 'PAID',
            },
            _sum: {
                totalAmount: true,
            },
        }),
    ]);

    return {
        totalStores,
        totalUsers,
        totalInvoices,
        totalCards,
        totalActivations,
        totalRevenue: totalRevenue._sum.totalAmount || 0,
    };
}

export async function createCompany(data: {
    name: string;
    taxId: string;
    email: string;
    phone: string;
    address?: string;
    billingFrequency: 'DAILY' | 'THREE_DAYS' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
    commissionRate: number;
}) {
    return prisma.company.create({
        data,
    });
}

export async function updateCompany(
    id: string,
    data: {
        name?: string;
        email?: string;
        phone?: string;
        address?: string;
        isActive?: boolean;
        billingFrequency?: 'DAILY' | 'THREE_DAYS' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
        commissionRate?: number;
    }
) {
    return prisma.company.update({
        where: { id },
        data,
    });
}

export async function deleteCompany(id: string) {
    return prisma.company.delete({
        where: { id },
    });
}

