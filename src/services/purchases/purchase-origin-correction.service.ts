import "server-only";

import type { Prisma } from "@prisma/client";

import prisma from "@/lib/prisma";
import { runSerializableTransaction } from "@/lib/prisma-transaction";
import { badGateway, badRequest, conflict, forbidden, notFound, serviceUnavailable } from "@/lib/errors";
import {
    correctCodeRequestPurchaseOrigin,
    type CommercialPurchaseOrigin,
    type DiemHttpError,
} from "@/lib/devdiem/fulfillment";
import type { AuthenticatedActor } from "@/lib/auth/actor";
import { resolvePurchaseOrigin, type RequestedOrigin } from "./purchase-origin";
import { purchaseOriginSnapshot } from "@/lib/purchases/origin-snapshot";

const PLATFORM_ROLES = new Set(["SUPER_ADMIN", "SYSTEM_ADMIN"]);

function assertPlatform(actor: Pick<AuthenticatedActor, "role">) {
    if (!PLATFORM_ROLES.has(actor.role)) throw forbidden("Solo un administrador de plataforma puede corregir el origen");
}

function sameOrigin(a: CommercialPurchaseOrigin | null, b: CommercialPurchaseOrigin | null) {
    return JSON.stringify(a) === JSON.stringify(b);
}

async function loadPurchase(id: string, db: Prisma.TransactionClient | typeof prisma) {
    return db.codePurchase.findUnique({
        where: { id },
        select: {
            id: true,
            companyId: true,
            storeId: true,
            purchaseOriginPhoneId: true,
            originLabelSnapshot: true,
            diemRequestId: true,
            status: true,
            purchaseOriginPhone: { select: { phone: true } },
        },
    });
}

function mapRemoteError(error: unknown) {
    const status = (error as DiemHttpError | undefined)?.status;
    const correlationId = (error as DiemHttpError | undefined)?.correlationId;
    const details = correlationId ? { correlationId } : undefined;
    if (status === 409) return conflict("El origen comercial cambió en Diem; vuelve a cargar la compra", details);
    if (status === 400 || status === 422) return badRequest("Diem rechazó la corrección de origen", details);
    if (typeof status === "number" && status >= 500) return badGateway("Diem no pudo corregir el origen", "DIEM_UNAVAILABLE", details);
    return serviceUnavailable("No fue posible conectar con Diem", "DIEM_UNREACHABLE", details);
}

export async function listPurchaseOriginCorrectionData(params: {
    actor: AuthenticatedActor;
    companyId: string;
    query?: string;
}) {
    assertPlatform(params.actor);
    const company = await prisma.company.findUnique({
        where: { id: params.companyId },
        select: { id: true, name: true },
    });
    if (!company) throw notFound("Compañía no encontrada");
    const query = params.query?.trim() ?? "";
    const [productMatches, userMatches, phoneMatches, storeMatches] = query ? await Promise.all([
        prisma.product.findMany({
            where: { name: { contains: query, mode: "insensitive" } },
            select: { id: true },
        }),
        prisma.user.findMany({
            where: {
                companyId: params.companyId,
                OR: [
                    { name: { contains: query, mode: "insensitive" } },
                    { email: { contains: query, mode: "insensitive" } },
                ],
            },
            select: { id: true },
        }),
        prisma.purchaseOriginPhone.findMany({
            where: {
                companyId: params.companyId,
                OR: [
                    { phone: { contains: query } },
                    { label: { contains: query, mode: "insensitive" } },
                ],
            },
            select: { id: true },
        }),
        prisma.store.findMany({
            where: { companyId: params.companyId, name: { contains: query, mode: "insensitive" } },
            select: { id: true },
        }),
    ]) : [[], [], [], []];
    const purchases = await prisma.codePurchase.findMany({
        where: {
            companyId: params.companyId,
            status: "COMPLETED",
            diemRequestId: { not: null },
            ...(query ? {
                OR: [
                    { id: { contains: query, mode: "insensitive" } },
                    { originLabelSnapshot: { contains: query, mode: "insensitive" } },
                    { productId: { in: productMatches.map((row) => row.id) } },
                    { userId: { in: userMatches.map((row) => row.id) } },
                    { purchaseOriginPhoneId: { in: phoneMatches.map((row) => row.id) } },
                    { storeId: { in: storeMatches.map((row) => row.id) } },
                ],
            } : {}),
        },
        select: {
            id: true,
            companyId: true,
            storeId: true,
            purchaseOriginPhoneId: true,
            originLabelSnapshot: true,
            diemRequestId: true,
            occurredAt: true,
            count: true,
            productId: true,
            denomination: { select: { amount: true, currency: true } },
            purchaseOriginPhone: { select: { phone: true } },
        },
        orderBy: [{ occurredAt: "desc" }, { occurredSequence: "desc" }, { id: "desc" }],
        take: 50,
    });
    const [stores, phones, products] = await Promise.all([
        prisma.store.findMany({
            where: { companyId: params.companyId, isActive: true },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
        }),
        prisma.purchaseOriginPhone.findMany({
            where: { companyId: params.companyId, isActive: true },
            select: { id: true, phone: true, label: true },
            orderBy: [{ label: "asc" }, { phone: "asc" }],
        }),
        prisma.product.findMany({
            where: { id: { in: [...new Set(purchases.map((purchase) => purchase.productId))] } },
            select: { id: true, name: true },
        }),
    ]);
    const productNames = new Map(products.map((product) => [product.id, product.name]));
    return {
        company,
        stores,
        phones,
        purchases: purchases.map((purchase) => ({
            id: purchase.id,
            occurredAt: purchase.occurredAt,
            count: purchase.count,
            productName: productNames.get(purchase.productId) ?? "Producto",
            denomination: purchase.denomination,
            origin: purchaseOriginSnapshot(purchase),
        })),
    };
}

export async function applyPurchaseOriginCorrection(params: {
    actor: AuthenticatedActor;
    purchaseId: string;
    origin: RequestedOrigin;
    reason: string;
    idempotencyKey: string;
}) {
    assertPlatform(params.actor);
    const reason = params.reason.trim();
    if (reason.length < 3) throw badRequest("El motivo es obligatorio");
    const purchase = await loadPurchase(params.purchaseId, prisma);
    if (!purchase) throw notFound("Compra no encontrada");
    if (purchase.status !== "COMPLETED") throw conflict("Solo se puede corregir el origen de una compra completada");
    if (!purchase.diemRequestId) throw conflict("La compra todavía no tiene una solicitud asociada en Diem");
    const resolved = await resolvePurchaseOrigin({
        actor: { ...params.actor, purchaseOriginPhoneId: null },
        targetCompanyId: purchase.companyId,
        requestedOrigin: params.origin,
    });
    const targetStore = resolved.storeId
        ? await prisma.store.findFirst({ where: { id: resolved.storeId, companyId: purchase.companyId }, select: { name: true } })
        : null;
    const targetPhone = resolved.purchaseOriginPhoneId
        ? await prisma.purchaseOriginPhone.findFirst({
            where: { id: resolved.purchaseOriginPhoneId, companyId: purchase.companyId },
            select: { phone: true },
        })
        : null;
    const expectedOrigin = purchaseOriginSnapshot(purchase);
    const newOrigin: CommercialPurchaseOrigin = resolved.purchaseOriginPhoneId
        ? {
            kind: "phone",
            id: resolved.purchaseOriginPhoneId,
            label: resolved.labelSnapshot,
            phone: targetPhone?.phone ?? null,
        }
        : {
            kind: "store",
            id: resolved.storeId!,
            label: resolved.labelSnapshot ?? targetStore?.name ?? null,
        };
    if (sameOrigin(expectedOrigin, newOrigin)) return { purchaseId: purchase.id, origin: newOrigin, changed: false };

    try {
        await correctCodeRequestPurchaseOrigin({
            requestId: purchase.diemRequestId,
            idempotencyKey: `purchase-origin:${params.idempotencyKey}`,
            expectedOrigin,
            newOrigin,
            reason,
            correlationId: `purchase-origin:${params.purchaseId}:${params.idempotencyKey}`,
        });
    } catch (error) {
        throw mapRemoteError(error);
    }

    return runSerializableTransaction(prisma, async (tx) => {
        const current = await loadPurchase(params.purchaseId, tx);
        if (!current) throw notFound("Compra no encontrada");
        if (current.status !== "COMPLETED" || current.diemRequestId !== purchase.diemRequestId) {
            throw conflict("La compra cambió durante la corrección; vuelve a cargarla");
        }
        const currentOrigin = purchaseOriginSnapshot(current);
        if (sameOrigin(currentOrigin, newOrigin)) {
            return { purchaseId: current.id, origin: newOrigin, changed: false };
        }
        if (!sameOrigin(currentOrigin, expectedOrigin)) {
            throw conflict("El origen de la compra cambió durante la corrección; vuelve a cargarla");
        }
        await tx.codePurchase.update({
            where: { id: current.id },
            data: {
                storeId: resolved.storeId,
                purchaseOriginPhoneId: resolved.purchaseOriginPhoneId,
                originLabelSnapshot: resolved.labelSnapshot,
            },
        });
        await tx.auditLog.create({
            data: {
                action: "PURCHASE_ORIGIN_CORRECTED",
                userId: params.actor.id,
                companyId: current.companyId,
                storeId: resolved.storeId,
                entityType: "CodePurchase",
                entityId: current.id,
                before: expectedOrigin ?? undefined,
                after: newOrigin,
                details: { reason, diemRequestId: current.diemRequestId, idempotencyKey: params.idempotencyKey },
            },
        });
        return { purchaseId: current.id, origin: newOrigin, changed: true };
    });
}
