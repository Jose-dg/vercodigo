"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

import { getSessionUser } from "@/lib/auth/session";
import { canMutateQr, cardVisibilityFilter } from "@/lib/auth/tenant-scope";

async function requireQrMutation(cardId: string) {
    const user = await getSessionUser();
    if (!user) return { error: "No autorizado" as const };
    if (!canMutateQr(user)) return { error: "Sin permisos" as const };

    const card = await prisma.card.findFirst({
        where: { id: cardId, ...cardVisibilityFilter(user) },
        select: { id: true },
    });
    if (!card) return { error: "Tarjeta no encontrada" as const };
    return { user };
}

export async function toggleQRStatus(id: string, currentStatus: boolean) {
    const gate = await requireQrMutation(id);
    if ("error" in gate) return { success: false, error: gate.error };

    try {
        await prisma.card.update({
            where: { id },
            data: {
                isActivated: !currentStatus,
                scanCount: 0,
            },
        });
        revalidatePath("/qr");
        return { success: true };
    } catch (error) {
        console.error("Error toggling QR status:", error);
        return { success: false, error: "Failed to toggle status" };
    }
}

export async function deleteQR(id: string) {
    const gate = await requireQrMutation(id);
    if ("error" in gate) return { success: false, error: gate.error };

    try {
        await prisma.card.delete({ where: { id } });
        revalidatePath("/qr");
        return { success: true };
    } catch (error) {
        console.error("Error deleting QR:", error);
        return { success: false, error: "Failed to delete QR" };
    }
}

export async function updateQRKey(id: string, keyCode: string) {
    const gate = await requireQrMutation(id);
    if ("error" in gate) return { success: false, error: gate.error };

    try {
        const trimmedKey = keyCode.trim();
        if (!trimmedKey) {
            return { success: false, error: "Key code cannot be empty" };
        }

        const card = await prisma.card.findUnique({
            where: { id },
            select: { uuid: true, productId: true },
        });
        if (!card) {
            return { success: false, error: "Card not found" };
        }

        const existingKey = await prisma.key.findUnique({
            where: { code: trimmedKey },
            include: { card: true },
        });

        if (existingKey?.card && existingKey.card.id !== id) {
            await prisma.card.update({
                where: { id: existingKey.card.id },
                data: { keyId: null },
            });
        }

        const key = await prisma.key.upsert({
            where: { code: trimmedKey },
            update: { isVerified: true },
            create: {
                code: trimmedKey,
                productId: card.productId,
                isVerified: true,
            },
        });

        await prisma.card.update({
            where: { id },
            data: { keyId: key.id },
        });

        revalidatePath(`/scan/${card.uuid}`);
        revalidatePath("/qr");
        return { success: true };
    } catch (error) {
        console.error("[updateQRKey] Error updating QR key:", error);
        return { success: false, error: "Failed to update key" };
    }
}

export async function updateQRStore(id: string, storeId: string) {
    const gate = await requireQrMutation(id);
    if ("error" in gate) return { success: false, error: gate.error };

    try {
        const store = await prisma.store.findUnique({ where: { id: storeId } });
        if (!store) {
            return { success: false, error: "Store not found" };
        }

        await prisma.card.update({
            where: { id },
            data: { storeId },
        });

        revalidatePath("/qr");
        return { success: true };
    } catch (error) {
        console.error("Error updating QR store:", error);
        return { success: false, error: "Failed to update store" };
    }
}

interface UpdateQRData {
    productId: string;
    storeId: string;
    fabricationUnitCost: number;
    scanCount: number;
    maxScans: number;
}

export async function updateQR(id: string, data: UpdateQRData) {
    const gate = await requireQrMutation(id);
    if ("error" in gate) return { success: false, error: gate.error };

    try {
        await prisma.card.update({
            where: { id },
            data: {
                productId: data.productId,
                storeId: data.storeId,
                fabricationUnitCost: data.fabricationUnitCost,
                scanCount: data.scanCount,
                maxScans: data.maxScans,
            },
        });

        revalidatePath("/qr");
        return { success: true };
    } catch (error) {
        console.error("Error updating QR:", error);
        return { success: false, error: "Failed to update QR" };
    }
}
