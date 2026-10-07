import "server-only";

import type { AuthenticatedActor } from "@/lib/auth/actor";
import { actorIsPlatform } from "@/lib/auth/actor";
import { AppError } from "@/lib/errors";
import prisma from "@/lib/prisma";

const denominationSelect = { id: true, amount: true, currency: true, devDiemProductId: true } as const;
const productSelect = {
    id: true, name: true, sku: true, brand: true, category: true, imageUrl: true, isActive: true,
    isGiftCard: true, minAmount: true, maxAmount: true, devDiemProductId: true, createdAt: true,
    denominations: { select: denominationSelect, orderBy: { amount: "asc" as const } },
} as const;

export async function getProductsForManagement(actor: AuthenticatedActor) {
    if (!actorIsPlatform(actor)) throw new AppError("Solo plataforma puede administrar productos", 403, "FORBIDDEN");
    return prisma.product.findMany({ select: productSelect, orderBy: { createdAt: "desc" } });
}

export async function getPurchasableProducts(enabledIds: string[]) {
    return prisma.product.findMany({
        where: { isActive: true, OR: [{ devDiemProductId: { in: enabledIds } }, { denominations: { some: { devDiemProductId: { in: enabledIds } } } }] },
        select: productSelect,
        orderBy: { name: "asc" },
    });
}

export async function createProductForActor(actor: AuthenticatedActor, input: {
    name: string; sku: string; brand: string; category?: string | null; devDiemProductId?: string | null;
    denominations: Array<{ amount: number; currency: string; devDiemProductId?: string | null }>;
}) {
    if (!actorIsPlatform(actor)) throw new AppError("Solo plataforma puede crear productos", 403, "FORBIDDEN");
    return prisma.product.create({
        data: {
            name: input.name, sku: input.sku, brand: input.brand, category: input.category,
            devDiemProductId: input.devDiemProductId || null,
            denominations: { create: input.denominations.map((item) => ({ ...item, devDiemProductId: item.devDiemProductId || null })) },
        },
        select: productSelect,
    });
}
