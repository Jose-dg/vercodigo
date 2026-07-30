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
            // Numbers scoped to this store only.
            authorizedPhones: true,
            // Company info plus numbers authorized company-wide (storeId: null),
            // which also apply to this store.
            company: {
                include: {
                    authorizedPhones: { where: { storeId: null } },
                },
            },
        },
    });
}

export async function getStores() {
    return prisma.store.findMany();
}

export async function deleteStore(id: string) {
    return prisma.store.delete({ where: { id } });
}
