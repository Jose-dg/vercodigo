import { Prisma } from "@prisma/client";

import prisma from "@/lib/prisma";
import { badRequest, conflict, notFound } from "@/lib/errors";
import type { TokenPayload } from "@/lib/auth";
import {
    buildCodeRequestCommand,
    buildCommercialAccountCode,
    sendCodeRequest,
    getCodeRequest,
    isDiemContractError,
    isDiemRateLimited,
    revealCodeRequest,
} from "@/lib/devdiem/fulfillment";
import { debit } from "@/services/wallet/wallet.service";
import { resolveCost } from "@/services/costing/costing.service";
import { summarizeCodeDelivery } from "@/lib/codes/delivery-counts";
import { buildPurchaseTimeline } from "@/lib/codes/purchase-timeline";
import { resolvePurchaseOrigin, type RequestedOrigin } from "@/services/purchases/purchase-origin";
import { purchaseOriginSnapshot } from "@/lib/purchases/origin-snapshot";
import { isSettledFulfillmentStatus } from "@/services/self-service/fulfillment-lifecycle";
import { frozenCodeRequestCommand } from "@/services/self-service/diem-request-snapshot";
import {
    OPEN_CODE_PURCHASE_STATUSES,
    isOpenCodePurchaseStatus,
    updateOpenCodePurchase,
} from "@/services/self-service/code-purchase-state";

const TERMINAL_FAILURES = new Set(["failed", "cancelled"]);
const PLATFORM_ROLES = new Set(["SUPER_ADMIN", "SYSTEM_ADMIN"]);

export type Actor = Pick<TokenPayload, "id" | "role" | "companyId" | "storeId">;

export function buildPurchaseVisibilityFilter(
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
    const delivery = summarizeCodeDelivery({
        status: purchase.status,
        billedCount: "count" in purchase && typeof purchase.count === "number" ? purchase.count : undefined,
        deliveredCodes: purchase.deliveredCodes,
    });
    return {
        ...purchase,
        kind: "purchase" as const,
        detailHref: "id" in purchase ? `/codes/purchases/${String(purchase.id)}` : undefined,
        cardUuid: null,
        productName: extras?.productName,
        requesterLabel: extras?.requesterLabel,
        keys: purchase.status === "COMPLETED" ? delivery.codes.map((code) => ({ code })) : [],
        deliveredCodeCount: delivery.deliveredCodeCount,
        hasDeliveryCountMismatch: delivery.hasDeliveryCountMismatch,
        isPending: isOpenCodePurchaseStatus(purchase.status),
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
    if (!purchases.length) return [];
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

    return purchases.map((row) =>
        serializePurchase(row, {
            productName: productNameById.get(row.productId),
            requesterLabel: requesterById.get(row.userId),
        }),
    );
}

/** Newest code purchases visible to the actor, serialized for "Mis solicitudes". */
export async function listSerializedCodePurchases(
    user: Actor,
    params: { limit: number; companyId?: string | null },
) {
    const purchases = await prisma.codePurchase.findMany({
        where: buildPurchaseVisibilityFilter(user, params.companyId),
        include: { denomination: true },
        orderBy: [{ occurredAt: "desc" }, { occurredSequence: "desc" }, { id: "desc" }],
        take: params.limit,
    });
    return enrichPurchases(purchases);
}

const loadPurchase = (id: string) => prisma.codePurchase.findUniqueOrThrow({
    where: { id },
    include: { denomination: true },
});

function persistedCodesOf(purchase: { deliveredCodes: Prisma.JsonValue }) {
    return Array.isArray(purchase.deliveredCodes)
        ? purchase.deliveredCodes.filter((code): code is string => typeof code === "string")
        : [];
}

/**
 * The only place a code purchase is debited. One local transaction moves the
 * purchase from open to COMPLETED with a compare-and-set and, only for the
 * winner, writes its single wallet consumption. A concurrent processor either
 * blocks on the row lock and then sees COMPLETED, or loses the CAS.
 */
async function settleCodePurchase(purchaseId: string, productName: string) {
    try {
        return await prisma.$transaction(async (tx) => {
            const won = await updateOpenCodePurchase(tx, purchaseId, {
                status: "COMPLETED",
                fulfillmentStatus: "delivered",
                completedAt: new Date(),
                nextRetryAt: null,
                lastError: null,
            });
            const current = await tx.codePurchase.findUniqueOrThrow({
                where: { id: purchaseId },
                include: { denomination: true },
            });
            if (!won) return current;

            if (persistedCodesOf(current).length !== current.count) {
                throw conflict("La entrega persistida está incompleta");
            }
            const existing = await tx.walletTransaction.findUnique({
                where: { codePurchaseId: current.id },
                select: { id: true },
            });
            if (existing) {
                // An open purchase must never own a consumption. Abort instead of
                // silently completing so the inconsistency is investigated.
                throw conflict(`La compra ${current.id} ya tiene un consumo sin estar completada`);
            }
            await debit({
                companyId: current.companyId,
                amount: current.totalAmount,
                currency: current.currency,
                description: `Compra de ${current.count} código(s) ${productName}`,
                createdById: current.userId,
                codePurchaseId: current.id,
                sourceAmount: current.sourceAmount ?? undefined,
                sourceCurrency: current.sourceCurrency ?? undefined,
                appliedExchangeRate: current.appliedExchangeRate ?? undefined,
                tx,
            });
            return current;
        }, { maxWait: 5_000, timeout: 10_000 });
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            // The unique (codePurchaseId) invariant rejected a second debit.
            console.error("[code-purchase] duplicate consumption rejected", { purchaseId });
            return loadPurchase(purchaseId);
        }
        throw error;
    }
}

export async function processCodePurchase(purchaseId: string) {
    let purchase = await prisma.codePurchase.findUnique({
        where: { id: purchaseId },
        include: { denomination: true },
    });
    if (!purchase) throw notFound("Compra no encontrada");
    if (isSettledFulfillmentStatus(purchase.status)) {
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

    // Every local write below is conditional on the purchase still being open.
    // When another processor settled it first, return that state unchanged.
    const writeWhileOpen = async (data: Parameters<typeof updateOpenCodePurchase>[2]) => {
        const applied = await updateOpenCodePurchase(prisma, purchaseId, data);
        return { applied, current: await loadPurchase(purchaseId) };
    };

    try {
        if (!purchase.diemRequestId) {
            const current = purchase;
            const buildCommand = async () => {
                const [user, originCompany, originStore, originPhone] = await Promise.all([
                    prisma.user.findUnique({
                        where: { id: current.userId },
                        select: { email: true, name: true },
                    }),
                    prisma.company.findUnique({
                        where: { id: current.companyId },
                        select: { name: true },
                    }),
                    current.storeId
                        ? prisma.store.findFirst({
                            where: {
                                id: current.storeId,
                                companyId: current.companyId,
                            },
                            select: { name: true },
                        })
                        : Promise.resolve(null),
                    current.purchaseOriginPhoneId
                        ? prisma.purchaseOriginPhone.findFirst({
                            where: {
                                id: current.purchaseOriginPhoneId,
                                companyId: current.companyId,
                            },
                            select: { phone: true },
                        })
                        : Promise.resolve(null),
                ]);
                if (!user?.email) throw conflict("El usuario necesita un email para recibir el código");
                const [firstName, ...lastName] = (user.name || user.email).trim().split(/\s+/);
                return buildCodeRequestCommand({
                    idempotencyKey: current.idempotencyKey,
                    externalReference: `DIEM-SAS-PURCHASE-${current.id}`,
                    correlationId: `code-purchase:${current.id}`,
                    source: "partner_api",
                    productId: remoteProductId,
                    quantity: current.count,
                    recipient: {
                        firstName,
                        lastName: lastName.join(" "),
                        email: user.email,
                    },
                    commercial: {
                        accountCode: buildCommercialAccountCode(current.companyId),
                        referenceNamespace: "code_purchase",
                        currencyCode: current.currency,
                        unitPrice: current.totalAmount / current.count,
                        totalAmount: current.totalAmount,
                    },
                    metadata: {
                        code_purchase_id: current.id,
                        company_id: current.companyId,
                        company_name: originCompany?.name ?? null,
                        store_id: current.storeId,
                        store_name: originStore?.name ?? null,
                        purchase_origin: purchaseOriginSnapshot({
                            ...current,
                            purchaseOriginPhone: originPhone,
                        }),
                        commercial_occurred_at: current.occurredAt.toISOString(),
                        commercial_sequence: current.occurredSequence,
                    },
                });
            };
            // Idempotent in Diem: concurrent processors send the same frozen command.
            const command = await frozenCodeRequestCommand({
                stored: current.diemRequestSnapshot,
                build: buildCommand,
                persistIfAbsent: async (frozen) => (await prisma.codePurchase.updateMany({
                    where: { id: current.id, diemRequestSnapshot: { equals: Prisma.DbNull } },
                    data: { diemRequestSnapshot: frozen as Prisma.InputJsonValue },
                })).count,
                reload: async () => (await loadPurchase(current.id)).diemRequestSnapshot,
            });
            const request = await sendCodeRequest(command);
            const linked = await prisma.codePurchase.updateMany({
                where: {
                    id: purchase.id,
                    status: { in: [...OPEN_CODE_PURCHASE_STATUSES] },
                    OR: [{ diemRequestId: null }, { diemRequestId: request.id }],
                },
                data: {
                    diemRequestId: request.id,
                    fulfillmentStatus: request.status,
                    attempts: { increment: 1 },
                    lastError: null,
                    nextRetryAt: null,
                },
            });
            purchase = await loadPurchase(purchaseId);
            if (!linked.count) {
                if (isSettledFulfillmentStatus(purchase.status)) return serializePurchase(purchase);
                throw conflict("La compra ya está vinculada a otra solicitud de Diem");
            }
        }

        // Always revalidate the remote commercial link before reveal or debit,
        // including retries that already persisted the delivered codes.
        const request = await getCodeRequest(purchase.diemRequestId!);
        if (TERMINAL_FAILURES.has(request.status)) {
            const { current } = await writeWhileOpen({
                status: "FAILED",
                fulfillmentStatus: request.status,
                lastError: `Fulfillment terminó en estado ${request.status}`,
                nextRetryAt: null,
            });
            return serializePurchase(current);
        }
        if (request.status === "action_required" || request.status === "pending_review") {
            // Pause only. After Diem approves, the partner webhook resumes.
            const { current } = await writeWhileOpen({
                status: "ACTION_REQUIRED",
                fulfillmentStatus: request.status,
                ...(request.status === "pending_review"
                    ? { lastError: "Diem exige revisión manual de esta solicitud. No se debitó la wallet." }
                    : {}),
                nextRetryAt: null,
            });
            return serializePurchase(current);
        }
        if (!["allocated", "delivered", "partially_delivered"].includes(request.status)) {
            const { current } = await writeWhileOpen({
                status: request.status === "awaiting_stock" ? "AWAITING_STOCK" : "PENDING",
                fulfillmentStatus: request.status,
                nextRetryAt: null,
            });
            return serializePurchase(current);
        }

        const persistedCodes = persistedCodesOf(purchase);
        if (persistedCodes.length !== purchase.count) {
            // Idempotent in Diem: the same correlation id reveals the same codes.
            const codes = await revealCodeRequest(request.id, `code-purchase:${purchase.id}`);
            if (codes.length !== purchase.count) {
                throw new Error(`Diem reveló ${codes.length} de ${purchase.count} códigos`);
            }
            const { applied, current } = await writeWhileOpen({
                deliveredCodes: codes,
                fulfillmentStatus: "delivered",
                nextRetryAt: null,
                lastError: null,
            });
            if (!applied) return serializePurchase(current);
        }

        return serializePurchase(await settleCodePurchase(purchase.id, product.name));
    } catch (error) {
        const message = error instanceof Error ? error.message : "Error desconocido";
        const permanent = isDiemContractError(error);
        const leaveQueue = permanent && !purchase.diemRequestId;
        await updateOpenCodePurchase(prisma, purchaseId, {
            attempts: { increment: 1 },
            lastError: message.slice(0, 1000),
            nextRetryAt: null,
            ...(leaveQueue ? { status: "ACTION_REQUIRED" as const } : {}),
        }).catch(() => undefined);
        throw error;
    }
}

export async function purchaseCodes(params: {
    userId: string;
    actorRole: string;
    targetCompanyId?: string;
    storeId?: string;
    origin?: RequestedOrigin;
    productId: string;
    denominationId?: string;
    count: number;
    idempotencyKey: string;
    quotedUnitAmount?: number;
    quotedCurrency?: string;
    quotedRate?: number | null;
}) {
    const { userId, storeId, productId, denominationId, count, actorRole, targetCompanyId } = params;
    if (count <= 0) throw badRequest("Cantidad debe ser mayor a 0");
    if (count > 100) throw badRequest("Máximo 100 códigos por compra");

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, companyId: true, storeId: true, email: true, role: true, purchaseOriginPhoneId: true },
    });
    if (!user?.email) throw badRequest("El usuario necesita un email para recibir códigos");

    const resolvedOrigin = await resolvePurchaseOrigin({
        actor: { ...user, role: actorRole },
        targetCompanyId,
        requestedOrigin: params.origin,
        legacyStoreId: storeId,
    });
    const { companyId, storeId: resolvedStoreId } = resolvedOrigin;

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
    const remoteProductId = denomination?.devDiemProductId ?? product.devDiemProductId;
    if (!remoteProductId) {
        throw conflict("El producto no está mapeado al catálogo de Diem");
    }

    // Stock is informational only, not a gate: Diem accepts requests against
    // depleted inventory and parks them as "awaiting_stock". Diem does not
    // re-allocate on restock by itself; a Diem operator retries the request and
    // the webhook then settles it here (see processCodePurchase below).
    const durableIdempotencyKey = `diem-sas-purchase:${companyId}:${params.idempotencyKey}`;
    const matchesRequest = (existing: {
        userId: string;
        productId: string;
        denominationId: string | null;
        count: number;
        storeId: string | null;
        companyId: string;
        purchaseOriginPhoneId: string | null;
    }) => (
        existing.userId === userId
        && existing.productId === productId
        && existing.denominationId === (denomination?.id ?? null)
        && existing.count === count
        && existing.storeId === resolvedStoreId
        && existing.companyId === companyId
        && existing.purchaseOriginPhoneId === resolvedOrigin.purchaseOriginPhoneId
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
            const billingCurrency = unitCost?.currency ?? denomination?.currency ?? "USD";
            if (
                params.quotedUnitAmount != null
                && (
                    Math.abs(params.quotedUnitAmount - unitAmount) > 0.005
                    || params.quotedCurrency?.toUpperCase() !== billingCurrency.toUpperCase()
                    || (params.quotedRate != null
                        && (unitCost?.exchangeRate == null
                            || Math.abs(params.quotedRate - unitCost.exchangeRate) > 0.0001))
                )
            ) {
                throw conflict("La tarifa cambió después de mostrar el total. Revisa el valor y confirma nuevamente.");
            }
            return tx.codePurchase.create({
                data: {
                    userId,
                    companyId,
                    storeId: resolvedStoreId,
                    purchaseOriginPhoneId: resolvedOrigin.purchaseOriginPhoneId,
                    originLabelSnapshot: resolvedOrigin.labelSnapshot,
                    productId,
                    denominationId: denomination?.id,
                    count,
                    totalAmount: unitAmount * count,
                    currency: billingCurrency,
                    sourceAmount: unitCost?.sourceAmount != null
                        ? unitCost.sourceAmount * count
                        : null,
                    sourceCurrency: unitCost?.sourceCurrency ?? null,
                    appliedExchangeRate: unitCost?.exchangeRate ?? null,
                    billingUnitAmount: unitAmount,
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
    } catch (error) {
        const pending = await prisma.codePurchase.findUniqueOrThrow({
            where: { id: purchase.id },
            include: { denomination: true },
        });
        // Soft-pending only for transient Diem pressure. Contract/auth failures
        // must leave the "En cola" lane so operators can fix grants and retry.
        if (isDiemRateLimited(error)) {
            return serializePurchase(pending);
        }
        if (pending.status === "ACTION_REQUIRED" || isSettledFulfillmentStatus(pending.status)) {
            return serializePurchase(pending);
        }
        if (isDiemContractError(error)) {
            await updateOpenCodePurchase(prisma, purchase.id, {
                status: "ACTION_REQUIRED",
                lastError: (error instanceof Error ? error.message : "Contrato Diem").slice(0, 1000),
                nextRetryAt: null,
            });
            return serializePurchase(await loadPurchase(purchase.id));
        }
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
    const [product, requester, walletTransactions] = await Promise.all([
        prisma.product.findUnique({
            where: { id: purchase.productId },
            select: { name: true, brand: true, category: true, imageUrl: true },
        }),
        prisma.user.findUnique({
            where: { id: purchase.userId },
            select: { name: true, email: true },
        }),
        prisma.walletTransaction.findMany({
            where: { codePurchaseId: purchase.id, status: { in: ["CONFIRMED", "PENDING"] } },
            orderBy: { createdAt: "asc" },
            select: {
                id: true,
                type: true,
                status: true,
                amount: true,
                balanceAfter: true,
                description: true,
                createdAt: true,
                wallet: { select: { currency: true } },
            },
        }),
    ]);
    return {
        ...serializePurchase(purchase, {
            productName: product?.name,
            requesterLabel: requester?.name?.trim() || requester?.email,
        }),
        productBrand: product?.brand ?? null,
        productCategory: product?.category ?? null,
        productImageUrl: product?.imageUrl ?? null,
        unitPrice: purchase.count > 0 ? purchase.totalAmount / purchase.count : purchase.totalAmount,
        timeline: buildPurchaseTimeline(purchase),
        walletTransactions: walletTransactions.map(({ wallet, ...transaction }) => ({
            ...transaction,
            currency: wallet.currency,
        })),
    };
}
