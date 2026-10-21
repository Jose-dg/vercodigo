import "server-only";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import type { UserRole } from "@prisma/client";

import prisma from "@/lib/prisma";
import { managementDestinationsForRole, type ManagementDestination } from "./navigation";

export type AuthenticatedActor = {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    companyId: string | null;
    storeId: string | null;
    /** La clave la asignó un admin: se sugiere cambiarla (aviso no bloqueante). */
    mustChangePassword?: boolean;
};

const PLATFORM_ROLES = new Set<UserRole>(["SUPER_ADMIN", "SYSTEM_ADMIN"]);

export function actorIsPlatform(actor: Pick<AuthenticatedActor, "role">) {
    return PLATFORM_ROLES.has(actor.role);
}

/**
 * Reloads the actor from the database on every protected server request.
 * Clerk identifies the person (password, Google, Apple, sessions); the database
 * remains authoritative for role, company and store.
 */
export async function getAuthenticatedActor(): Promise<AuthenticatedActor | null> {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) return null;

    const user = await prisma.user.findUnique({
        where: { clerkUserId },
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isActive: true,
            companyId: true,
            storeId: true,
            passwordAssignedAt: true,
            company: { select: { isActive: true } },
            store: { select: { isActive: true, companyId: true } },
        },
    });

    if (!user?.isActive) return null;
    if (!PLATFORM_ROLES.has(user.role)) {
        if (!user.companyId || !user.company?.isActive) return null;
        if (user.storeId && (!user.store?.isActive || user.store.companyId !== user.companyId)) {
            return null;
        }
    }

    return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        companyId: user.companyId,
        storeId: user.storeId,
        mustChangePassword: user.passwordAssignedAt !== null,
    };
}

export async function requireAuthenticatedActor(): Promise<AuthenticatedActor> {
    const actor = await getAuthenticatedActor();
    if (actor) return actor;
    const { userId, redirectToSignIn } = await auth();
    // Sin sesión: al login, conservando la URL (p. ej. el enlace de un correo a su orden).
    if (!userId) return redirectToSignIn();
    // Con sesión de Clerk pero sin acceso al portal: se explica, sin bucle de redirecciones.
    redirect("/auth/continue");
}

export async function getActorCompanyName(actor: AuthenticatedActor): Promise<string> {
    if (actorIsPlatform(actor)) return "Diem";
    if (!actor.companyId) return "Empresa";
    const company = await prisma.company.findFirst({
        where: { id: actor.companyId, isActive: true },
        select: { name: true },
    });
    return company?.name ?? "Empresa";
}

export async function requireManagementAccess(destination: ManagementDestination) {
    const actor = await requireAuthenticatedActor();
    if (!managementDestinationsForRole(actor.role).includes(destination)) notFound();
    return actor;
}
