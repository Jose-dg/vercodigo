"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function toggleQRStatus(id: string, currentStatus: boolean) {
    try {
        await prisma.card.update({
            where: { id },
            data: {
                isActivated: !currentStatus,
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
        const card = await prisma.card.findUnique({
            where: { id },
            select: { uuid: true, productId: true },
        });

        if (!card) {
            return { success: false, error: "Card not found" };
        }

        // Create or update key and link to card
        const key = await prisma.key.upsert({
            where: { code: keyCode },
            update: {
                isVerified: true,
            },
            create: {
                code: keyCode,
                productId: card.productId,
                isVerified: true,
            },
        });

        await prisma.card.update({
            where: { id },
            data: {
                keyId: key.id,
            },
        });

        revalidatePath(`/scan/${card.uuid}`);
        revalidatePath("/qr");

        return { success: true };
    } catch (error) {
        console.error("Error updating QR key:", error);
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
