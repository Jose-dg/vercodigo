import type { Prisma, UserRole } from "@prisma/client";

import prisma from "../../lib/prisma.ts";
import { badRequest, forbidden, notFound } from "../../lib/errors.ts";

type Db = Prisma.TransactionClient | typeof prisma;
type RequestedOrigin =
    | { kind: "phone"; id: string }
    | { kind: "store"; id: string };

const PLATFORM_ROLES = new Set<UserRole | string>(["SUPER_ADMIN", "SYSTEM_ADMIN"]);

export type ResolvedPurchaseOrigin = {
    companyId: string;
    storeId: string | null;
    purchaseOriginPhoneId: string | null;
    labelSnapshot: string | null;
};

/** Canonical Colombian mobile number used for matching and uniqueness. */
export function normalizePurchaseOriginPhone(value: string): string {
    const digits = value.replace(/\D/g, "");
    const normalized = digits.length === 12 && digits.startsWith("57")
        ? digits.slice(2)
        : digits;
    if (!/^3\d{9}$/.test(normalized)) {
        throw badRequest("Ingresa un número celular colombiano válido de 10 dígitos");
    }
    return normalized;
}

/** Resolve wallet ownership and optional commercial attribution in one place. */
export async function resolvePurchaseOrigin(params: {
    actor: {
        id: string;
        role: UserRole | string;
        companyId: string | null;
        storeId: string | null;
        purchaseOriginPhoneId: string | null;
    };
    targetCompanyId?: string | null;
    requestedOrigin?: RequestedOrigin | null;
    legacyStoreId?: string | null;
    db?: Db;
}): Promise<ResolvedPurchaseOrigin> {
    const db = params.db ?? prisma;
    const isPlatform = PLATFORM_ROLES.has(params.actor.role);
    const companyId = isPlatform
        ? params.targetCompanyId?.trim() ?? ""
        : params.actor.companyId ?? "";

    if (!companyId) {
        throw isPlatform
            ? badRequest("Selecciona la compañía a la que se cargará la compra")
            : forbidden("Usuario sin compañía asignada");
    }
    if (!await db.company.findUnique({ where: { id: companyId }, select: { id: true } })) {
        throw notFound("Compañía no encontrada");
    }

    const legacyOrigin = params.legacyStoreId
        ? { kind: "store" as const, id: params.legacyStoreId }
        : null;
    if (params.requestedOrigin && legacyOrigin) {
        throw badRequest("Indica el origen por sede o por número, no ambos");
    }
    if (!isPlatform && (params.requestedOrigin || legacyOrigin)) {
        throw forbidden("Un perfil empresarial no puede reemplazar su origen configurado");
    }
    const origin = isPlatform
        ? params.requestedOrigin ?? legacyOrigin
        : params.actor.purchaseOriginPhoneId
            ? { kind: "phone" as const, id: params.actor.purchaseOriginPhoneId }
            : params.actor.storeId
                ? { kind: "store" as const, id: params.actor.storeId }
                : null;
    if (isPlatform && !origin) {
        throw badRequest("Selecciona una sede o un número de origen");
    }
    if (!origin) {
        return { companyId, storeId: null, purchaseOriginPhoneId: null, labelSnapshot: null };
    }
    if (origin.kind === "store") {
        const store = await db.store.findFirst({
            where: { id: origin.id, companyId, isActive: true },
            select: { id: true, name: true },
        });
        if (!store) throw badRequest("La sede no pertenece a la compañía seleccionada");
        return { companyId, storeId: store.id, purchaseOriginPhoneId: null, labelSnapshot: store.name };
    }
    const phone = await db.purchaseOriginPhone.findFirst({
        where: { id: origin.id, companyId, isActive: true },
        select: { id: true, label: true },
    });
    if (!phone) throw badRequest("El número de origen no pertenece a la compañía seleccionada");
    return {
        companyId,
        storeId: null,
        purchaseOriginPhoneId: phone.id,
        labelSnapshot: phone.label,
    };
}

export type { RequestedOrigin };
