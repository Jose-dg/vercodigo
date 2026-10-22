import "server-only";

import type { UserRole } from "@prisma/client";

import { AppError } from "@/lib/errors";

/**
 * Sincronización de usuarios con Clerk. Clerk guarda la identidad (correo,
 * contraseña, Google, Apple, sesiones); nuestra base sigue siendo la autoridad de
 * rol, empresa y sede. El rol se copia a publicMetadata solo para que el proxy filtre
 * secciones sin consultar la base.
 */

type ClerkApiError = { errors?: { code?: string; message?: string; longMessage?: string }[] };

type ClerkClientFactory = typeof import("@clerk/nextjs/server").clerkClient;
export type ClerkApi = Pick<Awaited<ReturnType<ClerkClientFactory>>, "users" | "emailAddresses" | "sessions">;

let clientForTests: ClerkApi | null = null;

/** Tests swap the Backend API client for an in-memory fake. */
export function setClerkClientForTests(client: ClerkApi | null) {
    clientForTests = client;
}

async function clerkApi(): Promise<ClerkApi> {
    if (clientForTests) return clientForTests;
    // Loaded on demand so plain Node (tests, scripts) never boots the Next/React runtime.
    const { clerkClient } = await import("@clerk/nextjs/server");
    return clerkClient();
}

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
    const clerk = await clerkApi();
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
    const clerk = await clerkApi();
    const { data } = await clerk.sessions.getSessionList({ userId: clerkUserId, status: "active" });
    await Promise.all(data.map((session) => clerk.sessions.revokeSession(session.id)));
}

/**
 * Role, name, password and active state. The email has its own two-step flow
 * (assignPrimaryEmail, then removeEmailAddresses once the database agrees).
 */
export async function syncClerkUser(
    clerkUserId: string,
    changes: { role?: UserRole; name?: string; isActive?: boolean; password?: string },
): Promise<void> {
    const clerk = await clerkApi();
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

/**
 * Step 1 of an admin email change: the new address becomes verified and
 * primary, confirmed by reading the account back. Returns the addresses to
 * remove after the database is written (step 2), plus the previous primary to
 * restore if that write fails. Nothing is removed here, so a failure at any
 * point leaves the person able to sign in with their old email.
 */
export async function assignPrimaryEmail(
    clerkUserId: string,
    email: string,
): Promise<{ staleAddressIds: string[]; previousPrimaryId: string | null }> {
    const clerk = await clerkApi();
    try {
        const before = await clerk.users.getUser(clerkUserId);
        const existing = before.emailAddresses.find((address) => address.emailAddress.toLowerCase() === email);
        const target = existing
            ?? await clerk.emailAddresses.createEmailAddress({
                userId: clerkUserId,
                emailAddress: email,
                verified: true,
                primary: true,
            });
        if (existing) await clerk.users.updateUser(clerkUserId, { primaryEmailAddressID: existing.id });

        const after = await clerk.users.getUser(clerkUserId);
        const primary = after.emailAddresses.find((address) => address.id === after.primaryEmailAddressId);
        if (primary?.emailAddress.toLowerCase() !== email) {
            if (!existing) await clerk.emailAddresses.deleteEmailAddress(target.id).catch(() => undefined);
            throw new AppError("Clerk no dejó el correo nuevo como principal; no se cambió nada", 502, "CLERK_ERROR");
        }
        return {
            staleAddressIds: after.emailAddresses.filter((address) => address.id !== target.id).map((address) => address.id),
            previousPrimaryId: before.primaryEmailAddressId,
        };
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw toAppError(error, "No se pudo actualizar el correo");
    }
}

/** Undo step 1 when the database write failed: the old address is primary again. */
export async function restorePrimaryEmail(clerkUserId: string, previousPrimaryId: string | null) {
    if (!previousPrimaryId) return;
    const clerk = await clerkApi();
    await clerk.users.updateUser(clerkUserId, { primaryEmailAddressID: previousPrimaryId });
}

/**
 * Step 2: drop the old addresses (Clerk lets a person sign in with any verified
 * address of the account) and close open sessions. Best effort: returns what
 * could not be removed so the caller audits it.
 */
export async function removeEmailAddresses(clerkUserId: string, addressIds: string[]): Promise<string[]> {
    const clerk = await clerkApi();
    const failed: string[] = [];
    for (const id of addressIds) {
        try {
            await clerk.emailAddresses.deleteEmailAddress(id);
        } catch {
            failed.push(id);
        }
    }
    await revokeAllSessions(clerkUserId).catch(() => undefined);
    return failed;
}

/** The account as Clerk has it now: the webhook trusts this, not the event payload. */
export async function getClerkProfile(clerkUserId: string) {
    const clerk = await clerkApi();
    const user = await clerk.users.getUser(clerkUserId);
    const primary = user.emailAddresses.find((address) => address.id === user.primaryEmailAddressId);
    return {
        primaryEmail: primary?.emailAddress ?? null,
        emails: user.emailAddresses.map((address) => address.emailAddress.toLowerCase()),
        firstName: user.firstName,
        lastName: user.lastName,
    };
}

export async function deleteClerkUser(clerkUserId: string): Promise<void> {
    const clerk = await clerkApi();
    try {
        await clerk.users.deleteUser(clerkUserId);
    } catch (error) {
        throw toAppError(error, "No se pudo eliminar la cuenta");
    }
}
