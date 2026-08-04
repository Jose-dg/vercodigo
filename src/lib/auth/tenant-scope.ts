import { Prisma, UserRole } from "@prisma/client";

import type { TokenPayload } from "@/lib/auth";
import { isPlatformRole } from "@/lib/auth/abilities";

export type TenantActor = Pick<TokenPayload, "role" | "companyId" | "storeId">;

const NONE: Prisma.CardWhereInput = { id: "__none__" };

/** Filtro Prisma para listados de tarjetas/QR según rol. */
export function cardVisibilityFilter(user: TenantActor): Prisma.CardWhereInput {
    if (isPlatformRole(user.role as UserRole)) return {};
    if (user.role === "OWNER" || user.role === "GENERAL_ADMIN") {
        if (!user.companyId) return NONE;
        return { store: { companyId: user.companyId } };
    }
    if (user.role === "ADMIN") {
        if (!user.storeId) return NONE;
        return { storeId: user.storeId };
    }
    return NONE;
}

/** Filtro Prisma para tiendas visibles en formularios de QR. */
export function storeVisibilityFilter(user: TenantActor): Prisma.StoreWhereInput {
    if (isPlatformRole(user.role as UserRole)) return { isActive: true };
    if (user.role === "OWNER" || user.role === "GENERAL_ADMIN") {
        if (!user.companyId) return { id: "__none__" };
        return { isActive: true, companyId: user.companyId };
    }
    if (user.role === "ADMIN") {
        if (!user.storeId) return { id: "__none__" };
        return { id: user.storeId, isActive: true };
    }
    return { id: "__none__" };
}

export function canAccessQrList(user: TenantActor): boolean {
    return user.role !== "OPERATOR";
}

export function canCreateQr(user: TenantActor): boolean {
    return isPlatformRole(user.role as UserRole);
}

export function canMutateQr(user: TenantActor): boolean {
    return isPlatformRole(user.role as UserRole);
}
