import prisma from '@/lib/prisma';

export async function getAllProducts() {
    return prisma.product.findMany({
        where: { isActive: true },
        include: {
            denominations: true,
        },
    });
}

export async function getProductStats(productId: string) {
    const cardsCount = await prisma.card.count({
        where: { productId },
    });

    const redeemedCount = await prisma.card.count({
        where: { productId, isRedeemed: true },
    });

    return {
        totalCards: cardsCount,
        redeemedCards: redeemedCount,
        redemptionRate: cardsCount > 0 ? redeemedCount / cardsCount : 0,
    };
}
