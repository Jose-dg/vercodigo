import "server-only";

import type { BillingFrequency, Prisma } from "@prisma/client";
import type { AuthenticatedActor } from "@/lib/auth/actor";
import { actorIsPlatform } from "@/lib/auth/actor";
import { AppError } from "@/lib/errors";
import prisma from "@/lib/prisma";

const companyListSelect = {
    id: true, name: true, taxId: true, email: true, phone: true, address: true,
    isActive: true, billingFrequency: true, commissionRate: true, createdAt: true,
    _count: { select: { stores: true, users: true, invoices: true } },
} satisfies Prisma.CompanySelect;

function companyScope(actor: AuthenticatedActor, id?: string): Prisma.CompanyWhereInput {
    if (actorIsPlatform(actor)) return id ? { id } : {};
    if (!actor.companyId || !["OWNER", "GENERAL_ADMIN"].includes(actor.role)) {
        throw new AppError("Compañía fuera de alcance", 403, "FORBIDDEN");
    }
    return { id: id ?? actor.companyId, AND: { id: actor.companyId } };
}

export async function getCompaniesForActor(actor: AuthenticatedActor) {
    return prisma.company.findMany({ where: companyScope(actor), select: companyListSelect, orderBy: { createdAt: "desc" } });
}

export async function getCompanyForActor(actor: AuthenticatedActor, id: string) {
    return prisma.company.findFirst({
        where: companyScope(actor, id),
        select: {
            ...companyListSelect,
            updatedAt: true,
            stores: {
                select: { id: true, name: true, code: true, address: true, phone: true, isActive: true, _count: { select: { cards: true, activations: true } } },
                orderBy: { name: "asc" },
            },
        },
    });
}

export async function getCompanyStatsForActor(actor: AuthenticatedActor, companyId: string) {
    const company = await prisma.company.findFirst({ where: companyScope(actor, companyId), select: { id: true } });
    if (!company) throw new AppError("Compañía no encontrada", 404, "NOT_FOUND");
    const [totalStores, totalUsers, totalInvoices, totalCards, totalActivations, totalRevenue] = await Promise.all([
        prisma.store.count({ where: { companyId } }),
        prisma.user.count({ where: { companyId } }),
        prisma.invoice.count({ where: { companyId } }),
        prisma.card.count({ where: { store: { companyId } } }),
        prisma.cardActivation.count({ where: { store: { companyId } } }),
        prisma.invoice.aggregate({ where: { companyId, status: "PAID" }, _sum: { totalAmount: true } }),
    ]);
    return { totalStores, totalUsers, totalInvoices, totalCards, totalActivations, totalRevenue: totalRevenue._sum.totalAmount ?? 0 };
}

export type CompanyWriteInput = {
    name: string; taxId?: string; email: string; phone: string; address?: string | null;
    billingFrequency: BillingFrequency; commissionRate: number; isActive?: boolean;
};

export async function createCompanyForActor(actor: AuthenticatedActor, data: CompanyWriteInput & { taxId: string }) {
    if (!actorIsPlatform(actor)) throw new AppError("Solo plataforma puede crear compañías", 403, "FORBIDDEN");
    return prisma.company.create({ data, select: companyListSelect });
}

export async function updateCompanyForActor(actor: AuthenticatedActor, id: string, data: Partial<CompanyWriteInput>) {
    const existing = await prisma.company.findFirst({ where: companyScope(actor, id), select: { id: true } });
    if (!existing) throw new AppError("Compañía no encontrada", 404, "NOT_FOUND");
    return prisma.company.update({ where: { id: existing.id }, data, select: companyListSelect });
}

export async function deleteCompanyForActor(actor: AuthenticatedActor, id: string) {
    if (!actorIsPlatform(actor)) throw new AppError("Solo plataforma puede eliminar compañías", 403, "FORBIDDEN");
    const company = await prisma.company.findUnique({ where: { id }, select: { id: true, _count: { select: { stores: true } } } });
    if (!company) throw new AppError("Compañía no encontrada", 404, "NOT_FOUND");
    if (company._count.stores > 0) throw new AppError("No se puede eliminar una compañía con sedes", 409, "CONFLICT");
    await prisma.company.delete({ where: { id } });
}
