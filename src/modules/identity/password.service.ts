import "server-only";

import { clerkClient } from "@clerk/nextjs/server";

import prisma from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { writeAuditLog } from "@/services/self-service/audit.service";

import { PASSWORD_ISSUE_LABELS, passwordIssues } from "./domain";

/**
 * El usuario cambia su propia clave en Clerk. Exige la actual, aplica nuestra
 * política, cierra las sesiones en otros dispositivos y apaga el aviso de cambio
 * sugerido. La sesión actual sigue abierta.
 */
export async function changeOwnPassword(params: { userId: string; currentPassword: string; newPassword: string }) {
    const user = await prisma.user.findUnique({
        where: { id: params.userId },
        select: { id: true, email: true, clerkUserId: true, companyId: true, storeId: true, isActive: true },
    });
    if (!user?.isActive || !user.clerkUserId) throw new AppError("Usuario no encontrado", 404, "NOT_FOUND");

    const issues = passwordIssues(params.newPassword, user.email);
    if (issues.length > 0) {
        throw new AppError(issues.map((issue) => PASSWORD_ISSUE_LABELS[issue]).join(". "), 400, "WEAK_PASSWORD");
    }
    if (params.newPassword === params.currentPassword) {
        throw new AppError("La nueva contraseña debe ser distinta de la actual", 400, "SAME_PASSWORD");
    }

    const clerk = await clerkClient();
    try {
        await clerk.users.verifyPassword({ userId: user.clerkUserId, password: params.currentPassword });
    } catch {
        throw new AppError("La contraseña actual no es correcta", 400, "WRONG_PASSWORD");
    }
    try {
        await clerk.users.updateUser(user.clerkUserId, {
            password: params.newPassword,
            signOutOfOtherSessions: true,
        });
    } catch (error) {
        // Clerk también rechaza claves filtradas en brechas conocidas.
        const message = (error as { errors?: { longMessage?: string; message?: string }[] })?.errors?.[0];
        throw new AppError(message?.longMessage ?? message?.message ?? "No se pudo cambiar la contraseña", 400, "PASSWORD_REJECTED");
    }

    await prisma.user.update({ where: { id: user.id }, data: { mustChangePassword: false } });
    await writeAuditLog({
        action: "password.changed",
        userId: user.id,
        companyId: user.companyId,
        storeId: user.storeId,
        entityType: "User",
        entityId: user.id,
    });
}
