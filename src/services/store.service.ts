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

export async function getStores() {
    return prisma.store.findMany();
}

export async function createStore(data: any) {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const companyId = "clvya1q5100001y6g26y2k89d"; // Hardcoded for now, you should get this from the logged in user.
    const phone = "1234567890"; // Hardcoded for now.

    return prisma.store.create({
        data: {
            ...data,
            code,
            companyId,
            phone,
        },
    });
}

export async function deleteStore(id: string) {
    return prisma.store.delete({ where: { id } });
}
