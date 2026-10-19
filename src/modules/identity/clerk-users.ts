import "server-only";

import { clerkClient } from "@clerk/nextjs/server";
import type { UserRole } from "@prisma/client";

import { AppError } from "@/lib/errors";

/**
 * Sincronización de usuarios con Clerk. Clerk guarda la identidad (correo,
 * contraseña, Google, Apple, sesiones); nuestra base sigue siendo la autoridad de
 * rol, empresa y sede. El rol se copia a publicMetadata solo para que el proxy filtre
 * secciones sin consultar la base.
 */

type ClerkApiError = { errors?: { code?: string; message?: string; longMessage?: string }[] };

/** Mensaje legible de un error de Clerk (correo repetido, clave filtrada, etc.). */
function toAppError(error: unknown, fallback: string): AppError {
    const first = (error as ClerkApiError)?.errors?.[0];
    if (first?.code === "form_identifier_exists") {
        return new AppError("Ya existe una cuenta con ese correo", 409, "CONFLICT");
    }
    if (first?.code === "form_password_pwned") {
        return new AppError("Esa contraseña apareció en una filtración conocida; usa otra o genera una", 400, "PASSWORD_REJECTED");
    }
    return new AppError(first?.longMessage ?? first?.message ?? fallback, 400, "CLERK_ERROR");
}

export async function createClerkUser(input: { email: string; name: string; password: string; role: UserRole }): Promise<string> {
    const clerk = await clerkClient();
    try {
        const user = await clerk.users.createUser({
            emailAddress: [input.email],
            password: input.password,
            firstName: input.name,
            publicMetadata: { role: input.role },
        });
        return user.id;
    } catch (error) {
        throw toAppError(error, "No se pudo crear la cuenta");
    }
}

/** Cierra todas las sesiones activas (restablecimiento por un admin, desactivación). */
async function revokeAllSessions(clerkUserId: string) {
    const clerk = await clerkClient();
    const { data } = await clerk.sessions.getSessionList({ userId: clerkUserId, status: "active" });
    await Promise.all(data.map((session) => clerk.sessions.revokeSession(session.id)));
}

export async function syncClerkUser(
    clerkUserId: string,
    changes: { role?: UserRole; name?: string; email?: string; isActive?: boolean; password?: string },
): Promise<void> {
    const clerk = await clerkClient();
    try {
        if (changes.role) {
            await clerk.users.updateUserMetadata(clerkUserId, { publicMetadata: { role: changes.role } });
        }
        if (changes.name || changes.password) {
            await clerk.users.updateUser(clerkUserId, {
                ...(changes.name ? { firstName: changes.name } : {}),
                ...(changes.password ? { password: changes.password } : {}),
            });
        }
        if (changes.email) {
            // El nuevo correo pasa a ser el principal; el anterior queda como secundario.
            await clerk.emailAddresses.createEmailAddress({
                userId: clerkUserId,
                emailAddress: changes.email,
                verified: true,
                primary: true,
            });
        }
        if (changes.isActive === false) {
            await clerk.users.banUser(clerkUserId);
        } else if (changes.isActive === true) {
            await clerk.users.unbanUser(clerkUserId);
        }
        if (changes.password) await revokeAllSessions(clerkUserId);
    } catch (error) {
        throw toAppError(error, "No se pudo actualizar la cuenta");
    }
}

export async function deleteClerkUser(clerkUserId: string): Promise<void> {
    const clerk = await clerkClient();
    try {
        await clerk.users.deleteUser(clerkUserId);
    } catch (error) {
        throw toAppError(error, "No se pudo eliminar la cuenta");
    }
}
