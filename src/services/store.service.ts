import "server-only";

import { nanoid } from "nanoid";
import type { Prisma } from "@prisma/client";
import type { AuthenticatedActor } from "@/lib/auth/actor";
import { actorIsPlatform } from "@/lib/auth/actor";
import { AppError } from "@/lib/errors";
import prisma from "@/lib/prisma";

function storeScope(actor: AuthenticatedActor, id?: string): Prisma.StoreWhereInput {
    if (actorIsPlatform(actor)) return id ? { id } : {};
    if (!actor.companyId) throw new AppError("Usuario sin compañía", 403, "FORBIDDEN");
    if (actor.role === "OWNER" || actor.role === "GENERAL_ADMIN") return { companyId: actor.companyId, ...(id ? { id } : {}) };
    if (!actor.storeId) throw new AppError("Usuario sin sede", 403, "FORBIDDEN");
    return { id: id ?? actor.storeId, companyId: actor.companyId, AND: { id: actor.storeId } };
}

const storeSelect = {
    id: true, name: true, code: true, address: true, phone: true, isActive: true,
    companyId: true, createdAt: true, company: { select: { name: true } },
} satisfies Prisma.StoreSelect;

export async function getStoresForActor(actor: AuthenticatedActor) {
    return prisma.store.findMany({ where: storeScope(actor), select: storeSelect, orderBy: { name: "asc" } });
}

export async function createStoreForActor(actor: AuthenticatedActor, input: { companyId?: string; name: string; address: string; phone: string }) {
    if (!["SUPER_ADMIN", "SYSTEM_ADMIN", "OWNER", "GENERAL_ADMIN"].includes(actor.role)) throw new AppError("No puedes crear sedes", 403, "FORBIDDEN");
    const companyId = actorIsPlatform(actor) ? input.companyId : actor.companyId;
    if (!companyId) throw new AppError("Selecciona una compañía", 400, "BAD_REQUEST");
    const company = await prisma.company.findFirst({ where: { id: companyId, isActive: true }, select: { id: true } });
    if (!company) throw new AppError("Compañía no encontrada", 404, "NOT_FOUND");
    return prisma.store.create({
        data: { companyId, name: input.name, address: input.address, phone: input.phone, code: nanoid(8).toUpperCase() },
        select: storeSelect,
    });
}

export async function deleteStoreForActor(actor: AuthenticatedActor, id: string) {
    if (!["SUPER_ADMIN", "SYSTEM_ADMIN", "OWNER", "GENERAL_ADMIN"].includes(actor.role)) throw new AppError("No puedes eliminar sedes", 403, "FORBIDDEN");
    const store = await prisma.store.findFirst({ where: storeScope(actor, id), select: { id: true } });
    if (!store) throw new AppError("Sede no encontrada", 404, "NOT_FOUND");
    await prisma.store.delete({ where: { id: store.id } });
}
