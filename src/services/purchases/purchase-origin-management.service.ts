import "server-only";

import { Prisma } from "@prisma/client";

import type { AuthenticatedActor } from "@/lib/auth/actor";
import { actorIsPlatform } from "@/lib/auth/actor";
import { conflict, forbidden, notFound } from "@/lib/errors";
import prisma from "@/lib/prisma";
import { runSerializableTransaction } from "@/lib/prisma-transaction";
import { normalizePurchaseOriginPhone } from "./purchase-origin";

const originSelect = {
    id: true,
    companyId: true,
    storeId: true,
    phone: true,
    label: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
    store: { select: { id: true, name: true } },
    _count: { select: { users: true, purchases: true } },
} satisfies Prisma.PurchaseOriginPhoneSelect;

export type PurchaseOriginPhoneInput = {
    phone: string;
    label?: string | null;
    storeId?: string | null;
};

export type PurchaseOriginPhoneUpdate = Partial<PurchaseOriginPhoneInput> & {
    isActive?: boolean;
};

function requirePlatform(actor: AuthenticatedActor) {
    if (!actorIsPlatform(actor)) {
        throw forbidden("Solo un administrador de plataforma puede administrar números de origen");
    }
}

function labelOrPhone(label: string | null | undefined, phone: string) {
    return label?.trim() || phone;
}

async function assertCompanyAndStore(
    db: Prisma.TransactionClient,
    companyId: string,
    storeId: string | null,
) {
    const company = await db.company.findFirst({
        where: { id: companyId, isActive: true },
        select: { id: true },
    });
    if (!company) throw notFound("Compañía no encontrada o inactiva");
    if (!storeId) return;
    const store = await db.store.findFirst({
        where: { id: storeId, companyId, isActive: true },
        select: { id: true },
    });
    if (!store) throw conflict("La sede no pertenece a la compañía o está inactiva");
}

function mapUniquePhone(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw conflict("Ese número ya está registrado para la compañía");
    }
    throw error;
}

export async function listPurchaseOriginPhonesForActor(params: {
    actor: AuthenticatedActor;
    companyId?: string | null;
    includeInactive?: boolean;
}) {
    const isPlatform = actorIsPlatform(params.actor);
    const companyId = isPlatform ? params.companyId?.trim() : params.actor.companyId;
    if (!companyId) throw notFound("Compañía no encontrada");

    return prisma.purchaseOriginPhone.findMany({
        where: {
            companyId,
            ...(!isPlatform || !params.includeInactive ? { isActive: true } : {}),
        },
        select: originSelect,
        orderBy: [{ isActive: "desc" }, { label: "asc" }, { phone: "asc" }],
    });
}

export async function createPurchaseOriginPhone(params: {
    actor: AuthenticatedActor;
    companyId: string;
    input: PurchaseOriginPhoneInput;
}) {
    requirePlatform(params.actor);
    const phone = normalizePurchaseOriginPhone(params.input.phone);
    const storeId = params.input.storeId?.trim() || null;
    try {
        return await runSerializableTransaction(prisma, async (tx) => {
            await assertCompanyAndStore(tx, params.companyId, storeId);
            const created = await tx.purchaseOriginPhone.create({
                data: {
                    companyId: params.companyId,
                    storeId,
                    phone,
                    label: labelOrPhone(params.input.label, phone),
                },
                select: originSelect,
            });
            await tx.auditLog.create({
                data: {
                    action: "PURCHASE_ORIGIN_PHONE_CREATED",
                    userId: params.actor.id,
                    companyId: params.companyId,
                    storeId,
                    entityType: "PurchaseOriginPhone",
                    entityId: created.id,
                    after: { phone: created.phone, label: created.label, storeId, isActive: true },
                },
            });
            return created;
        });
    } catch (error) {
        return mapUniquePhone(error);
    }
}

export async function updatePurchaseOriginPhone(params: {
    actor: AuthenticatedActor;
    id: string;
    input: PurchaseOriginPhoneUpdate;
}) {
    requirePlatform(params.actor);
    try {
        return await runSerializableTransaction(prisma, async (tx) => {
            const current = await tx.purchaseOriginPhone.findUnique({
                where: { id: params.id },
                select: originSelect,
            });
            if (!current) throw notFound("Número de origen no encontrado");

            const phone = params.input.phone === undefined
                ? current.phone
                : normalizePurchaseOriginPhone(params.input.phone);
            const storeId = params.input.storeId === undefined
                ? current.storeId
                : params.input.storeId?.trim() || null;
            await assertCompanyAndStore(tx, current.companyId, storeId);

            if (phone !== current.phone && current._count.purchases > 0) {
                throw conflict("El número ya tiene compras. Crea uno nuevo y desactiva este para preservar el historial");
            }
            if (params.input.isActive === false && current._count.users > 0) {
                throw conflict("Reasigna los usuarios vinculados antes de desactivar este número");
            }

            const label = params.input.label === undefined
                ? (current.label === current.phone ? phone : current.label)
                : labelOrPhone(params.input.label, phone);
            const updated = await tx.purchaseOriginPhone.update({
                where: { id: current.id },
                data: { phone, label, storeId, isActive: params.input.isActive },
                select: originSelect,
            });
            await tx.auditLog.create({
                data: {
                    action: "PURCHASE_ORIGIN_PHONE_UPDATED",
                    userId: params.actor.id,
                    companyId: current.companyId,
                    storeId,
                    entityType: "PurchaseOriginPhone",
                    entityId: current.id,
                    before: {
                        phone: current.phone,
                        label: current.label,
                        storeId: current.storeId,
                        isActive: current.isActive,
                    },
                    after: { phone, label, storeId, isActive: updated.isActive },
                },
            });
            return updated;
        });
    } catch (error) {
        return mapUniquePhone(error);
    }
}
