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
