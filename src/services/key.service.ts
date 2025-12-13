import prisma from '@/lib/prisma';

export async function getAllKeys(filters?: {
    productId?: string;
    isVerified?: boolean;
    hasCard?: boolean;
}) {
    const where: any = {};

    if (filters?.productId) {
        where.productId = filters.productId;
    }

    if (filters?.isVerified !== undefined) {
        where.isVerified = filters.isVerified;
    }

    if (filters?.hasCard !== undefined) {
        where.card = filters.hasCard ? { isNot: null } : null;
    }

    return prisma.key.findMany({
        where,
        include: {
            product: true,
            card: {
                include: {
                    store: {
                        include: {
                            company: true,
                        },
                    },
                },
            },
        },
        orderBy: {
            createdAt: 'desc',
        },
    });
}

export async function getKeyById(id: string) {
    return prisma.key.findUnique({
        where: { id },
        include: {
            product: true,
            card: {
                include: {
                    store: {
                        include: {
                            company: true,
                        },
                    },
                    product: true,
                    denomination: true,
                },
            },
        },
    });
}

export async function getKeyByCode(code: string) {
    return prisma.key.findUnique({
        where: { code },
        include: {
            product: true,
            card: {
                include: {
                    store: {
                        include: {
                            company: true,
                        },
                    },
                },
            },
        },
    });
}

export async function createKey(data: {
    code: string;
    productId: string;
    isVerified?: boolean;
    transactionId?: string;
    expiresAt?: Date;
    notes?: string;
}) {
    return prisma.key.create({
        data,
    });
}

export async function updateKey(
    id: string,
    data: {
        isVerified?: boolean;
        transactionId?: string;
        expiresAt?: Date;
        notes?: string;
    }
) {
    return prisma.key.update({
        where: { id },
        data,
    });
}

export async function deleteKey(id: string) {
    return prisma.key.delete({
        where: { id },
    });
}

export async function getKeyStats() {
    const [
        totalKeys,
        verifiedKeys,
        keysWithCard,
        keysWithoutCard,
    ] = await Promise.all([
        prisma.key.count(),
        prisma.key.count({ where: { isVerified: true } }),
        prisma.key.count({ where: { card: { isNot: null } } }),
        prisma.key.count({ where: { card: null } }),
    ]);

    return {
        totalKeys,
        verifiedKeys,
        keysWithCard,
        keysWithoutCard,
        verificationRate: totalKeys > 0 ? verifiedKeys / totalKeys : 0,
    };
}

