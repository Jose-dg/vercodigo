import prisma from '@/lib/prisma';

export async function getAllBatches() {
    return prisma.cardBatch.findMany({
        include: {
            _count: {
                select: {
                    cards: true,
                },
            },
        },
        orderBy: {
            createdAt: 'desc',
        },
    });
}

export async function getBatchById(id: string) {
    return prisma.cardBatch.findUnique({
        where: { id },
        include: {
            cards: {
                include: {
                    product: true,
                    store: {
                        include: {
                            company: true,
                        },
                    },
                },
                take: 100,
                orderBy: {
                    createdAt: 'desc',
                },
            },
            _count: {
                select: {
                    cards: true,
                },
            },
        },
    });
}

export async function createBatch(data: {
    code: string;
    description?: string;
    manufacturer?: string;
    currency: string;
    totalCards: number;
    totalCost: number;
    notes?: string;
}) {
    return prisma.cardBatch.create({
        data,
    });
}

export async function updateBatch(
    id: string,
    data: {
        description?: string;
        manufacturer?: string;
        currency?: string;
        totalCost?: number;
        notes?: string;
    }
) {
    return prisma.cardBatch.update({
        where: { id },
        data,
    });
}

export async function deleteBatch(id: string) {
    return prisma.cardBatch.delete({
        where: { id },
    });
}

export async function getBatchStats(batchId: string) {
    const [
        totalCards,
        activatedCards,
        redeemedCards,
        totalCost,
    ] = await Promise.all([
        prisma.card.count({ where: { batchId } }),
        prisma.card.count({ where: { batchId, isActivated: true } }),
        prisma.card.count({ where: { batchId, isRedeemed: true } }),
        prisma.cardBatch.findUnique({
            where: { id: batchId },
            select: { totalCost: true },
        }),
    ]);

    return {
        totalCards,
        activatedCards,
        redeemedCards,
        totalCost: totalCost?.totalCost || 0,
        activationRate: totalCards > 0 ? activatedCards / totalCards : 0,
        redemptionRate: totalCards > 0 ? redeemedCards / totalCards : 0,
    };
}

