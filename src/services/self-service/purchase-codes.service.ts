import { Prisma } from "@prisma/client";

import prisma from "@/lib/prisma";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import type { TokenPayload } from "@/lib/auth";
import {
    createCodeRequest,
    getCodeRequest,
    revealCodeRequest,
} from "@/lib/devdiem/fulfillment";
import { debit } from "@/services/wallet/wallet.service";
import { resolveCost } from "@/services/costing/costing.service";

const RETRY_DELAY_MS = 60_000;
const TERMINAL_FAILURES = new Set(["failed", "cancelled"]);
const PENDING_STATUSES = ["PENDING", "AWAITING_STOCK", "FINALIZING", "ACTION_REQUIRED"] as const;
const PLATFORM_ROLES = new Set(["SUPER_ADMIN", "SYSTEM_ADMIN"]);

type Actor = Pick<TokenPayload, "id" | "role" | "companyId" | "storeId">;

function buildPurchaseVisibilityFilter(
    user: Actor,
    companyIdOverride?: string | null,
): Prisma.CodePurchaseWhereInput {
    if (PLATFORM_ROLES.has(user.role)) {
        if (companyIdOverride) return { companyId: companyIdOverride };
        return {};
    }
    if (user.role === "OWNER" || user.role === "GENERAL_ADMIN") {
        if (!user.companyId) return { id: "__none__" };
        return { companyId: user.companyId };
    }
    if (user.role === "ADMIN" || user.role === "OPERATOR") {
        if (!user.storeId) return { id: "__none__" };
        return { storeId: user.storeId };
    }
    return { userId: user.id };
}

function serializePurchase<T extends {
    deliveredCodes: Prisma.JsonValue | null;
    status: string;
    productId?: string;
    userId?: string;
}>(
    purchase: T,
    extras?: { productName?: string; requesterLabel?: string },
) {
    const codes = Array.isArray(purchase.deliveredCodes)
        ? purchase.deliveredCodes.filter((code): code is string => typeof code === "string")
        : [];
    return {
        ...purchase,
        productName: extras?.productName,
        requesterLabel: extras?.requesterLabel,
        keys: purchase.status === "COMPLETED" ? codes.map((code) => ({ code })) : [],
        isPending: PENDING_STATUSES.includes(purchase.status as typeof PENDING_STATUSES[number]),
        isSuccessful: purchase.status === "COMPLETED",
        needsAction: purchase.status === "ACTION_REQUIRED",
    };
}

async function enrichPurchases<
    T extends {
        productId: string;
        userId: string;
        deliveredCodes: Prisma.JsonValue | null;
        status: string;
    },
>(purchases: T[]) {
    if (!purchases.length) {
        return { pending: [], completed: [], failed: [] as ReturnType<typeof serializePurchase>[] };
    }
    const productIds = [...new Set(purchases.map((row) => row.productId))];
    const userIds = [...new Set(purchases.map((row) => row.userId))];
    const [products, users] = await Promise.all([
        prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, name: true },
        }),
        prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, email: true },
        }),
    ]);
    const productNameById = new Map(products.map((row) => [row.id, row.name]));
    const requesterById = new Map(
        users.map((row) => [row.id, row.name?.trim() || row.email]),
    );

    const serialized = purchases.map((row) =>
        serializePurchase(row, {
            productName: productNameById.get(row.productId),
            requesterLabel: requesterById.get(row.userId),
        }),
    );

    return {
        pending: serialized.filter((row) => row.isPending),
        completed: serialized.filter((row) => row.isSuccessful),
        failed: serialized.filter((row) =>
            row.status === "FAILED" || row.needsAction,
        ),
    };
}

export async function listCodePurchasesForUser(
    user: Actor,
    params?: { limit?: number; companyId?: string | null },
) {
    const limit = Math.min(Math.max(params?.limit ?? 40, 1), 100);
    const where = buildPurchaseVisibilityFilter(user, params?.companyId);
    const purchases = await prisma.codePurchase.findMany({
        where,
        include: { denomination: true },
        orderBy: { createdAt: "desc" },
        take: limit,
    });
    return enrichPurchases(purchases);
}

export async function refreshPendingCodePurchasesForUser(user: Actor) {
    const pendingRows = await prisma.codePurchase.findMany({
        where: {
            ...buildPurchaseVisibilityFilter(user),
            status: { in: [...PENDING_STATUSES] },
        },
        select: { id: true },
        orderBy: { createdAt: "asc" },
        take: 25,
    });
    for (const row of pendingRows) {
        try {
            await processCodePurchase(row.id);
        } catch {
            // Keep durable state; list endpoint will surface lastError.
        }
    }
    return listCodePurchasesForUser(user);
}

export async function processCodePurchase(purchaseId: string) {
    let purchase = await prisma.codePurchase.findUnique({
        where: { id: purchaseId },
        include: { denomination: true },
    });
    if (!purchase) throw notFound("Compra no encontrada");
    if (purchase.status === "COMPLETED" || purchase.status === "FAILED") {
        return serializePurchase(purchase);
    }

    const product = await prisma.product.findUnique({
        where: { id: purchase.productId },
        select: { name: true, devDiemProductId: true },
    });
    if (!product) throw notFound("Producto no encontrado");
    const remoteProductId =
        purchase.denomination?.devDiemProductId ?? product.devDiemProductId;
    if (!remoteProductId) {
        throw conflict("El producto no está mapeado al catálogo de Diem");
    }

    try {
        if (!purchase.diemRequestId) {
            const user = await prisma.user.findUnique({
                where: { id: purchase.userId },
                select: { email: true, name: true },
            });
            if (!user?.email) throw conflict("El usuario necesita un email para recibir el código");
            const [firstName, ...lastName] = (user.name || user.email).trim().split(/\s+/);
            const request = await createCodeRequest({
                idempotencyKey: purchase.idempotencyKey,
                externalReference: `DIEM-SAS-PURCHASE-${purchase.id}`,
                source: "partner_api",
                productId: remoteProductId,
                quantity: purchase.count,
                recipient: {
                    firstName,
                    lastName: lastName.join(" "),
                    email: user.email,
                },
                metadata: {
                    code_purchase_id: purchase.id,
                    company_id: purchase.companyId,
                    store_id: purchase.storeId,
                },
            });
            purchase = await prisma.codePurchase.update({
                where: { id: purchase.id },
                data: {
                    diemRequestId: request.id,
                    fulfillmentStatus: request.status,
                    attempts: { increment: 1 },
                    lastError: null,
                    nextRetryAt: new Date(Date.now() + RETRY_DELAY_MS),
                },
                include: { denomination: true },
            });
        }

        const persistedCodes = Array.isArray(purchase.deliveredCodes)
            ? purchase.deliveredCodes.filter((code): code is string => typeof code === "string")
            : [];
        const request = persistedCodes.length === purchase.count
            ? {
                id: purchase.diemRequestId!,
                status: "delivered" as const,
                external_reference: `DIEM-SAS-PURCHASE-${purchase.id}`,
            }
            : await getCodeRequest(purchase.diemRequestId!);
        if (TERMINAL_FAILURES.has(request.status)) {
            purchase = await prisma.codePurchase.update({
                where: { id: purchase.id },
                data: {
                    status: "FAILED",
                    fulfillmentStatus: request.status,
                    lastError: `Fulfillment terminó en estado ${request.status}`,
                    nextRetryAt: null,
                },
                include: { denomination: true },
            });
            return serializePurchase(purchase);
        }
        if (request.status === "action_required") {
            purchase = await prisma.codePurchase.update({
                where: { id: purchase.id },
                data: {
                    status: "ACTION_REQUIRED",
                    fulfillmentStatus: request.status,
                    nextRetryAt: null,
                },
                include: { denomination: true },
            });
            return serializePurchase(purchase);
        }
        if (!["allocated", "delivered", "partially_delivered"].includes(request.status)) {
            purchase = await prisma.codePurchase.update({
                where: { id: purchase.id },
                data: {
                    status: request.status === "awaiting_stock" ? "AWAITING_STOCK" : "PENDING",
                    fulfillmentStatus: request.status,
                    nextRetryAt: new Date(Date.now() + RETRY_DELAY_MS),
                },
                include: { denomination: true },
            });
            return serializePurchase(purchase);
        }

        const codes = persistedCodes.length === purchase.count
            ? persistedCodes
            : await revealCodeRequest(request.id, `code-purchase:${purchase.id}`);
        if (codes.length !== purchase.count) {
            throw new Error(`Diem reveló ${codes.length} de ${purchase.count} códigos`);
        }
        if (persistedCodes.length !== purchase.count) {
            purchase = await prisma.codePurchase.update({
                where: { id: purchase.id },
                data: {
                    deliveredCodes: codes,
                    fulfillmentStatus: "delivered",
                    status: "PENDING",
                    nextRetryAt: new Date(Date.now() + RETRY_DELAY_MS),
                    lastError: null,
                },
                include: { denomination: true },
            });
        }

        purchase = await prisma.$transaction(async (tx) => {
            const claimed = await tx.codePurchase.updateMany({
                where: {
                    id: purchase!.id,
                    status: { in: ["PENDING", "AWAITING_STOCK"] },
                },
                data: { status: "FINALIZING" },
            });
            const current = await tx.codePurchase.findUnique({ where: { id: purchase!.id } });
            if (!current) throw notFound("Compra no encontrada");
            if (!claimed.count || current.status === "COMPLETED") {
                return tx.codePurchase.findUniqueOrThrow({
                    where: { id: current.id },
                    include: { denomination: true },
                });
            }
            const currentCodes = Array.isArray(current.deliveredCodes)
                ? current.deliveredCodes.filter((code): code is string => typeof code === "string")
                : [];
            if (currentCodes.length !== current.count) {
                throw conflict("La entrega persistida está incompleta");
            }
            await debit({
                companyId: current.companyId,
                amount: current.totalAmount,
                currency: current.currency,
                description: `Compra de ${current.count} código(s) ${product.name}`,
                createdById: current.userId,
                codePurchaseId: current.id,
                tx,
            });
            return tx.codePurchase.update({
                where: { id: current.id },
                data: {
                    status: "COMPLETED",
                    fulfillmentStatus: "delivered",
                    deliveredCodes: currentCodes,
                    completedAt: new Date(),
                    nextRetryAt: null,
                    lastError: null,
                },
                include: { denomination: true },
            });
        });
        return serializePurchase(purchase);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Error desconocido";
        await prisma.codePurchase.update({
            where: { id: purchase.id },
            data: {
                attempts: { increment: 1 },
                lastError: message.slice(0, 1000),
                nextRetryAt: new Date(Date.now() + RETRY_DELAY_MS),
            },
        }).catch(() => undefined);
        throw error;
    }
}

export async function purchaseCodes(params: {
    userId: string;
    actorRole: string;
    targetCompanyId?: string;
    storeId?: string;
    productId: string;
    denominationId?: string;
    count: number;
    idempotencyKey: string;
}) {
    const { userId, storeId, productId, denominationId, count, actorRole, targetCompanyId } = params;
    if (count <= 0) throw badRequest("Cantidad debe ser mayor a 0");
    if (count > 100) throw badRequest("Máximo 100 códigos por compra");

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, companyId: true, storeId: true, email: true, role: true },
    });
    if (!user?.email) throw badRequest("El usuario necesita un email para recibir códigos");

    let companyId: string;
    if (PLATFORM_ROLES.has(actorRole)) {
        companyId = targetCompanyId?.trim() || "";
        if (!companyId) {
            throw badRequest("Selecciona la compañía a la que se cargará la compra");
        }
        const company = await prisma.company.findUnique({
            where: { id: companyId },
            select: { id: true },
        });
        if (!company) throw notFound("Compañía no encontrada");
    } else {
        if (!user.companyId) throw forbidden("Usuario inválido");
        companyId = user.companyId;
    }

    let resolvedStoreId = storeId ?? null;
    if (resolvedStoreId) {
        const store = await prisma.store.findFirst({
            where: { id: resolvedStoreId, companyId },
            select: { id: true },
        });
        if (!store) throw badRequest("La tienda no pertenece a la compañía seleccionada");
    } else if (!PLATFORM_ROLES.has(actorRole) && (actorRole === "ADMIN" || actorRole === "OPERATOR")) {
        resolvedStoreId = user.storeId;
    }

    const product = await prisma.product.findUnique({
        where: { id: productId },
        select: {
            id: true,
            name: true,
            devDiemProductId: true,
            denominations: {
                select: {
                    id: true,
                    amount: true,
                    currency: true,
                    devDiemProductId: true,
                },
            },
        },
    });
    if (!product) throw notFound("Producto no encontrado");

    let denomination = null;
    if (denominationId) {
        denomination = product.denominations.find((item) => item.id === denominationId) ?? null;
        if (!denomination) throw badRequest("La denominación no pertenece al producto");
    } else if (product.denominations.length === 1) {
        denomination = product.denominations[0];
    } else if (product.denominations.length > 1) {
        throw badRequest("Selecciona la denominación del producto");
    }
    if (!(denomination?.devDiemProductId ?? product.devDiemProductId)) {
        throw conflict("El producto no está mapeado al catálogo de Diem");
    }

    const durableIdempotencyKey = `diem-sas-purchase:${companyId}:${params.idempotencyKey}`;
    const matchesRequest = (existing: {
        userId: string;
        productId: string;
        denominationId: string | null;
        count: number;
        storeId: string | null;
        companyId: string;
    }) => (
        existing.userId === userId
        && existing.productId === productId
        && existing.denominationId === (denomination?.id ?? null)
        && existing.count === count
        && existing.storeId === resolvedStoreId
        && existing.companyId === companyId
    );
    let purchase;
    try {
        purchase = await prisma.$transaction(async (tx) => {
            const existing = await tx.codePurchase.findUnique({
                where: { idempotencyKey: durableIdempotencyKey },
                include: { denomination: true },
            });
            if (existing) {
                if (!matchesRequest(existing)) {
                    throw conflict("Idempotency-Key ya fue usada con otra compra");
                }
                return existing;
            }
            const unitCost = await resolveCost(companyId, productId, denomination?.id, tx);
            const fallbackAmount = denomination?.amount;
            const unitAmount = unitCost?.amount ?? fallbackAmount;
            if (!(unitAmount && unitAmount > 0)) {
                throw conflict("No existe un costo válido para este producto");
            }
            return tx.codePurchase.create({
                data: {
                    userId,
                    companyId,
                    storeId: resolvedStoreId,
                    productId,
                    denominationId: denomination?.id,
                    count,
                    totalAmount: unitAmount * count,
                    currency: unitCost?.currency ?? denomination?.currency ?? "USD",
                    status: "PENDING",
                    idempotencyKey: durableIdempotencyKey,
                },
                include: { denomination: true },
            });
        });
    } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
            throw error;
        }
        const existing = await prisma.codePurchase.findUnique({
            where: { idempotencyKey: durableIdempotencyKey },
            include: { denomination: true },
        });
        if (!existing || !matchesRequest(existing)) {
            throw conflict("Idempotency-Key ya fue usada con otra compra");
        }
        purchase = existing;
    }

    try {
        return await processCodePurchase(purchase.id);
    } catch {
        const pending = await prisma.codePurchase.findUniqueOrThrow({
            where: { id: purchase.id },
            include: { denomination: true },
        });
        return serializePurchase(pending);
    }
}

export async function getCodePurchaseForUser(purchaseId: string, user: Actor) {
    const purchase = await prisma.codePurchase.findFirst({
        where: {
            id: purchaseId,
            ...buildPurchaseVisibilityFilter(user),
        },
        include: { denomination: true },
    });
    if (!purchase) throw notFound("Compra no encontrada");
    const product = await prisma.product.findUnique({
        where: { id: purchase.productId },
        select: { name: true },
    });
    const requester = await prisma.user.findUnique({
        where: { id: purchase.userId },
        select: { name: true, email: true },
    });
    return serializePurchase(purchase, {
        productName: product?.name,
        requesterLabel: requester?.name?.trim() || requester?.email,
    });
}
