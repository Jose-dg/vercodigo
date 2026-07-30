import prisma from "@/lib/prisma";
import { User, UserRole } from "@prisma/client";
import { badRequest, forbidden, notFound } from "@/lib/errors";

const PLATFORM_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.SYSTEM_ADMIN];
const PRICE_MANAGER_ROLES: UserRole[] = [UserRole.OWNER, UserRole.GENERAL_ADMIN];

/**
 * Resuelve sobre qué compañía actúa el usuario y valida el scope: los roles de
 * compañía solo pueden tocar su propia compañía; la plataforma debe indicarla.
 */
function resolveCompanyScope(actor: Pick<User, "role" | "companyId">, requestedCompanyId?: string | null) {
    if (PLATFORM_ROLES.includes(actor.role)) {
        if (!requestedCompanyId) throw badRequest("companyId es requerido para usuarios de plataforma");
        return requestedCompanyId;
    }
    if (!actor.companyId) throw forbidden("Usuario sin compañía asignada");
    if (requestedCompanyId && requestedCompanyId !== actor.companyId) {
        throw forbidden("No puedes gestionar precios de otra compañía");
    }
    return actor.companyId;
}

/**
 * Catálogo para la grilla de la UI: cada producto activo con sus denominaciones
 * (o una fila sin denominación si no tiene), unido con el precio configurado.
 */
export async function getPriceCatalog(actor: Pick<User, "role" | "companyId">, requestedCompanyId?: string | null) {
    const companyId = resolveCompanyScope(actor, requestedCompanyId);

    const [products, prices, costs] = await Promise.all([
        prisma.product.findMany({
            where: { isActive: true },
            orderBy: { name: "asc" },
            select: {
                id: true,
                name: true,
                brand: true,
                sku: true,
                denominations: {
                    orderBy: { amount: "asc" },
                    select: { id: true, amount: true, currency: true },
                },
            },
        }),
        prisma.companyProductPrice.findMany({ where: { companyId, isActive: true } }),
        prisma.productCost.findMany({
            where: { isActive: true, OR: [{ companyId }, { companyId: null }] },
        }),
    ]);

    const priceFor = (productId: string, denominationId: string | null) =>
        prices.find((p) => p.productId === productId && p.denominationId === denominationId) ?? null;

    // Costo real que se le cobra a la compañía: tarifa negociada → costo global
    // → valor nominal de la denominación (misma precedencia que resolveCost).
    const costFor = (productId: string, denominationId: string | null, nominal: { amount: number; currency: string } | null) => {
        const match = (forCompany: string | null) =>
            costs.find((c) => c.productId === productId && c.denominationId === denominationId && c.companyId === forCompany);
        const companyCost = match(companyId);
        if (companyCost) return { amount: companyCost.cost, currency: companyCost.currency };
        const globalCost = match(null);
        if (globalCost) return { amount: globalCost.cost, currency: globalCost.currency };
        return nominal;
    };

    const rows = products.flatMap((product) => {
        if (product.denominations.length === 0) {
            const price = priceFor(product.id, null);
            const cost = costFor(product.id, null, null);
            return [{
                productId: product.id,
                productName: product.name,
                brand: product.brand,
                denominationId: null as string | null,
                wholesaleAmount: (cost?.amount ?? null) as number | null,
                wholesaleCurrency: (cost?.currency ?? null) as string | null,
                priceId: price?.id ?? null,
                salePrice: price?.salePrice ?? null,
                currency: price?.currency ?? null,
            }];
        }
        return product.denominations.map((d) => {
            const price = priceFor(product.id, d.id);
            const cost = costFor(product.id, d.id, { amount: d.amount, currency: d.currency });
            return {
                productId: product.id,
                productName: product.name,
                brand: product.brand,
                denominationId: d.id as string | null,
                wholesaleAmount: (cost?.amount ?? null) as number | null,
                wholesaleCurrency: (cost?.currency ?? null) as string | null,
                priceId: price?.id ?? null,
                salePrice: price?.salePrice ?? null,
                currency: price?.currency ?? null,
            };
        });
    });

    return { companyId, rows };
}

export async function upsertPrice(
    params: {
        companyId?: string | null;
        productId: string;
        denominationId?: string | null;
        salePrice: number;
        currency?: string;
    },
    actor: Pick<User, "role" | "companyId">
) {
    const companyId = resolveCompanyScope(actor, params.companyId);
    if (!(params.salePrice > 0)) throw badRequest("El precio de venta debe ser mayor a 0");

    const currency = (params.currency ?? "COP").trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) throw badRequest("Moneda inválida (código ISO de 3 letras)");

    const product = await prisma.product.findUnique({
        where: { id: params.productId },
        select: { id: true, denominations: { select: { id: true } } },
    });
    if (!product) throw notFound("Producto no encontrado");

    const denominationId = params.denominationId ?? null;
    if (denominationId && !product.denominations.some((d) => d.id === denominationId)) {
        throw badRequest("La denominación no pertenece al producto");
    }

    // Upsert manual: el unique (companyId, productId, denominationId) no
    // deduplica NULLs en Postgres, así que no se puede usar prisma.upsert.
    const existing = await prisma.companyProductPrice.findFirst({
        where: { companyId, productId: params.productId, denominationId },
    });

    if (existing) {
        return prisma.companyProductPrice.update({
            where: { id: existing.id },
            data: { salePrice: params.salePrice, currency, isActive: true },
        });
    }

    return prisma.companyProductPrice.create({
        data: { companyId, productId: params.productId, denominationId, salePrice: params.salePrice, currency },
    });
}

export async function deletePrice(priceId: string, actor: Pick<User, "role" | "companyId">) {
    const price = await prisma.companyProductPrice.findUnique({ where: { id: priceId } });
    if (!price) throw notFound("Precio no encontrado");
    resolveCompanyScope(actor, price.companyId);

    await prisma.companyProductPrice.delete({ where: { id: priceId } });
    return { success: true };
}

/**
 * Precio de venta configurado para un producto/denominación (referencia al vender).
 */
export async function getSalePrice(companyId: string, productId: string, denominationId?: string | null) {
    return prisma.companyProductPrice.findFirst({
        where: { companyId, productId, denominationId: denominationId ?? null, isActive: true },
    });
}
