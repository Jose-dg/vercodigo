import "server-only";

import { Prisma } from "@prisma/client";

import prisma from "@/lib/prisma";
import { badRequest, conflict, notFound } from "@/lib/errors";
import type { DeliveryRecipient } from "@/lib/codes/delivery-recipient";
import { resolveCost } from "@/services/costing/costing.service";
import { sandboxScenario } from "./sandbox-scenarios";

/**
 * Sandbox deliveries: the same validation as production (product, denomination,
 * price, expected price, idempotency) but nothing real happens. No CodePurchase,
 * no wallet movement, no Diem request, no email. They live in their own table so
 * they can never appear in "Mis solicitudes" or in a statement.
 */
export async function createSandboxDelivery(params: {
    companyId: string;
    apiKeyId: string;
    idempotencyKey: string;
    productId: string;
    denominationId?: string;
    quantity: number;
    recipient: DeliveryRecipient;
    expectedUnitPrice?: { amount: number; currency: string };
}) {
    const product = await prisma.product.findFirst({
        where: { id: params.productId, isActive: true },
        select: {
            id: true,
            devDiemProductId: true,
            denominations: { select: { id: true, devDiemProductId: true } },
        },
    });
    if (!product) throw notFound("Producto no encontrado");
    let denomination: { id: string; devDiemProductId: string | null } | null = null;
    if (params.denominationId) {
        denomination = product.denominations.find((row) => row.id === params.denominationId) ?? null;
        if (!denomination) throw badRequest("La denominación no pertenece al producto");
    } else if (product.denominations.length === 1) {
        denomination = product.denominations[0];
    } else if (product.denominations.length > 1) {
        throw badRequest("Selecciona la denominación del producto");
    }
    if (!(denomination?.devDiemProductId ?? product.devDiemProductId)) {
        throw conflict("El producto no está mapeado al catálogo de Diem");
    }

    const cost = await resolveCost(params.companyId, product.id, denomination?.id);
    if (!cost || !(cost.amount > 0)) throw conflict("No existe un costo válido para este producto");
    if (
        params.expectedUnitPrice
        && (Math.abs(params.expectedUnitPrice.amount - cost.amount) > 0.005
            || params.expectedUnitPrice.currency.toUpperCase() !== cost.currency.toUpperCase())
    ) {
        throw conflict("La tarifa cambió después de mostrar el total. Revisa el valor y confirma nuevamente.");
    }

    const scenario = sandboxScenario(params.recipient.email);
    const data = {
        companyId: params.companyId,
        apiKeyId: params.apiKeyId,
        idempotencyKey: params.idempotencyKey,
        productId: product.id,
        denominationId: denomination?.id ?? null,
        quantity: params.quantity,
        unitAmount: cost.amount,
        currency: cost.currency,
        recipientFirstName: params.recipient.firstName,
        recipientLastName: params.recipient.lastName,
        recipientEmail: params.recipient.email,
        status: scenario.status,
        emailDelivery: scenario.emailDelivery,
        completedAt: scenario.status === "completed" ? new Date() : null,
    };
    type Comparable = Pick<typeof data, "productId" | "denominationId" | "quantity" | "recipientEmail" | "recipientFirstName" | "recipientLastName">;
    const sameRequest = (row: Comparable) => (
        row.productId === data.productId
        && row.denominationId === data.denominationId
        && row.quantity === data.quantity
        && row.recipientEmail === data.recipientEmail
        && row.recipientFirstName === data.recipientFirstName
        && row.recipientLastName === data.recipientLastName
    );
    const existing = await prisma.sandboxDelivery.findUnique({
        where: { companyId_idempotencyKey: { companyId: params.companyId, idempotencyKey: params.idempotencyKey } },
    });
    if (existing) {
        if (!sameRequest(existing)) throw conflict("Idempotency-Key ya fue usada con otra compra");
        return existing;
    }
    try {
        return await prisma.sandboxDelivery.create({ data });
    } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
        const winner = await prisma.sandboxDelivery.findUniqueOrThrow({
            where: { companyId_idempotencyKey: { companyId: params.companyId, idempotencyKey: params.idempotencyKey } },
        });
        if (!sameRequest(winner)) throw conflict("Idempotency-Key ya fue usada con otra compra");
        return winner;
    }
}

export async function getSandboxDelivery(companyId: string, id: string) {
    const row = await prisma.sandboxDelivery.findFirst({ where: { id, companyId } });
    if (!row) throw notFound("Entrega no encontrada");
    return row;
}

/** A fixed, obviously fake balance: sandbox never reads or moves the real wallet. */
export async function sandboxWalletBalance(companyId: string) {
    const wallet = await prisma.wallet.findUnique({ where: { companyId }, select: { currency: true } });
    return { amount: 1_000_000, currency: wallet?.currency ?? "COP" };
}
