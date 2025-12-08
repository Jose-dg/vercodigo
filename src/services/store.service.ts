import prisma from '@/lib/prisma';

export async function getStoreStats(storeId: string) {
    const [
        totalCards,
        activatedCards,
        redeemedCards,
        activationsToday
    ] = await Promise.all([
        prisma.card.count({ where: { storeId } }),
        prisma.card.count({ where: { storeId, isActivated: true } }),
        prisma.card.count({ where: { storeId, isRedeemed: true } }),
        prisma.cardActivation.count({
            where: {
                storeId,
                activatedAt: {
                    gte: new Date(new Date().setHours(0, 0, 0, 0)),
                },
            },
        }),
    ]);

    return {
        totalCards,
        activatedCards,
        redeemedCards,
        activationsToday,
    };
}

export async function getStoreDetails(storeId: string) {
    return prisma.store.findUnique({
        where: { id: storeId },
        include: {
            company: true,
            authorizedPhones: true,
        },
    });
}
