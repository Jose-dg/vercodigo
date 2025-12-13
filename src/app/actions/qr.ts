"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function toggleQRStatus(id: string, currentStatus: boolean) {
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
    try {
        await prisma.card.delete({
            where: { id },
        });
        revalidatePath("/qr");
        return { success: true };
    } catch (error) {
        console.error("Error deleting QR:", error);
        return { success: false, error: "Failed to delete QR" };
    }
}

export async function updateQRKey(id: string, keyCode: string) {
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

        // Check if key exists and is assigned to another card
        const existingKey = await prisma.key.findUnique({
            where: { code: trimmedKey },
            include: { card: true }
        });

        if (existingKey && existingKey.card && existingKey.card.id !== id) {
            // Optional: Decide if we want to allow stealing. For now, let's error or steal.
            // Let's steal it (unassign from old card) to allow easy corrections.
            await prisma.card.update({
                where: { id: existingKey.card.id },
                data: { keyId: null }
            });
        }

        // Create or update key
        const key = await prisma.key.upsert({
            where: { code: trimmedKey },
            update: {
                isVerified: true,
            },
            create: {
                code: trimmedKey,
                productId: card.productId,
                isVerified: true,
            },
        });

        const updatedCard = await prisma.card.update({
            where: { id },
            data: {
                keyId: key.id,
            },
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
    try {
        const store = await prisma.store.findUnique({
            where: { id: storeId },
        });

        if (!store) {
            return { success: false, error: "Store not found" };
        }

        await prisma.card.update({
            where: { id },
            data: {
                storeId,
            },
        });

        revalidatePath("/qr");
        return { success: true };
    } catch (error) {
        console.error("Error updating QR store:", error);
        return { success: false, error: "Failed to update store" };
    }
}
