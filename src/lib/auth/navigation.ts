import type { UserRole } from "@prisma/client";

export type ManagementDestination =
    | "companies"
    | "stores"
    | "products"
    | "users"
    | "wallets"
    | "prices"
    | "rates";

export function homePathForRole(role: UserRole): string {
    if (role === "SUPER_ADMIN" || role === "SYSTEM_ADMIN") return "/admin";
    if (role === "OWNER" || role === "GENERAL_ADMIN") return "/overview";
    return "/codes/purchase";
}

export function managementDestinationsForRole(role: UserRole): ManagementDestination[] {
    if (role === "SUPER_ADMIN" || role === "SYSTEM_ADMIN") {
        return ["companies", "stores", "products", "users", "wallets", "prices", "rates"];
    }
    if (role === "OWNER" || role === "GENERAL_ADMIN") {
        return ["companies", "stores", "users", "prices", "rates"];
    }
    if (role === "ADMIN") return ["stores", "users", "prices", "rates"];
    return [];
}

