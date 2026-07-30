import crypto from "crypto";

import prisma from "@/lib/prisma";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import {
    createCodeRequest,
    getCodeRequest,
    revealCodeRequest,
} from "@/lib/devdiem/fulfillment";
import { assertCanActivateCard } from "./permissions.service";
import { checkRateLimit } from "./rate-limit.service";
import { writeAuditLog } from "./audit.service";
import { debit } from "@/services/wallet/wallet.service";
import { resolveCost } from "@/services/costing/costing.service";

const RETRY_DELAY_MS = 60_000;

function extractUuid(qr: string): string {
    const value = qr?.trim();
    if (!value) throw badRequest("QR vacío");
    try {
        const url = new URL(value);
        return url.pathname.split("/").filter(Boolean).at(-1) || value;
    } catch {
        return value;
    }
}

export async function processActivationJob(jobId: string) {
    let job = await prisma.activationJob.findUnique({
        where: { id: jobId },
        include: {
            card: {
                include: {
                    product: true,
                    denomination: true,
                    store: { include: { company: true } },
                },
            },
        },
    });
    if (!job) throw notFound("Trabajo de activación no encontrado");
    if (job.status === "COMPLETED") return { status: "COMPLETED", job };
    if (!job.userId) throw conflict("El trabajo no tiene usuario responsable");

    const remoteProductId =
        job.card.denomination?.devDiemProductId ?? job.card.product.devDiemProductId;
    if (!remoteProductId) throw conflict("El producto no está mapeado al catálogo de Diem");
    const actor = await prisma.user.findUnique({
        where: { id: job.userId },
        select: { email: true, name: true },
    });
    if (!actor?.email) throw conflict("El usuario necesita un email");

    try {
        if (!job.diemRequestId) {
            const [firstName, ...lastName] = (actor.name || actor.email).trim().split(/\s+/);
            const remote = await createCodeRequest({
                idempotencyKey: job.idempotencyKey,
                externalReference: `DIEM-SAS-ACTIVATION-${job.id}`,
                source: "physical_card",
                productId: remoteProductId,
                quantity: 1,
                recipient: {
                    firstName,
                    lastName: lastName.join(" "),
                    email: actor.email,
                },
                metadata: {
                    activation_job_id: job.id,
                    card_uuid: job.card.uuid,
                    company_id: job.card.store.companyId,
                    store_id: job.card.storeId,
                },
            });
            job = await prisma.activationJob.update({
                where: { id: job.id },
                data: {
                    diemRequestId: remote.id,
                    fulfillmentStatus: remote.status,
                    status: "PROCESSING",
                    attempts: { increment: 1 },
                    nextRetryAt: new Date(Date.now() + RETRY_DELAY_MS),
                    lastError: null,
                },
                include: {
                    card: {
                        include: {
                            product: true,
                            denomination: true,
                            store: { include: { company: true } },
                        },
                    },
                },
            });
        }

        const persistedCodes = Array.isArray(job.deliveredCodes)
            ? job.deliveredCodes.filter((code): code is string => typeof code === "string")
            : [];
        const remote = persistedCodes.length === 1
            ? {
                id: job.diemRequestId!,
                status: "delivered" as const,
                external_reference: `DIEM-SAS-ACTIVATION-${job.id}`,
            }
            : await getCodeRequest(job.diemRequestId!);
        if (["failed", "cancelled"].includes(remote.status)) {
            await prisma.$transaction([
                prisma.activationJob.update({
                    where: { id: job.id },
                    data: {
                        status: "FAILED",
                        fulfillmentStatus: remote.status,
                        lastError: `Fulfillment terminó en ${remote.status}`,
                        nextRetryAt: null,
                    },
                }),
                prisma.card.update({
                    where: { id: job.cardId },
                    data: {
                        activationLock: false,
                        activationLockBy: null,
                        activationLockAt: null,
                    },
                }),
            ]);
            return { status: "FAILED", jobId: job.id };
        }
        if (remote.status === "action_required") {
            await prisma.activationJob.update({
                where: { id: job.id },
                data: {
                    status: "ACTION_REQUIRED",
                    fulfillmentStatus: remote.status,
                    nextRetryAt: null,
                },
            });
            return { status: "ACTION_REQUIRED", jobId: job.id };
        }
        if (!["allocated", "delivered", "partially_delivered"].includes(remote.status)) {
            await prisma.activationJob.update({
                where: { id: job.id },
                data: {
                    status: remote.status === "awaiting_stock" ? "AWAITING_STOCK" : "PROCESSING",
                    fulfillmentStatus: remote.status,
                    nextRetryAt: new Date(Date.now() + RETRY_DELAY_MS),
                },
            });
            return { status: remote.status, jobId: job.id };
        }

        const codes = persistedCodes.length === 1
            ? persistedCodes
            : await revealCodeRequest(remote.id, `activation-job:${job.id}`);
        if (codes.length !== 1) throw new Error(`Diem reveló ${codes.length} códigos; se esperaba 1`);
        if (persistedCodes.length !== 1) {
            job = await prisma.activationJob.update({
                where: { id: job.id },
                data: {
                    deliveredCodes: codes,
                    fulfillmentStatus: "delivered",
                    status: "PROCESSING",
                    nextRetryAt: new Date(Date.now() + RETRY_DELAY_MS),
                    lastError: null,
                },
                include: {
                    card: {
                        include: {
                            product: true,
                            denomination: true,
                            store: { include: { company: true } },
                        },
                    },
                },
            });
        }

        const result = await prisma.$transaction(async (tx) => {
            const claimed = await tx.activationJob.updateMany({
                where: {
                    id: job!.id,
                    status: { in: ["PENDING", "PROCESSING", "AWAITING_STOCK"] },
                },
                data: { status: "FINALIZING" },
            });
            const currentCard = await tx.card.findUniqueOrThrow({ where: { id: job!.cardId } });
            if (!claimed.count || currentCard.isActivated) {
                const activation = await tx.cardActivation.findUnique({ where: { cardId: currentCard.id } });
                if (claimed.count) {
                    await tx.activationJob.update({
                        where: { id: job!.id },
                        data: {
                            status: "COMPLETED",
                            fulfillmentStatus: "delivered",
                            nextRetryAt: null,
                            lastError: null,
                        },
                    });
                }
                return { card: currentCard, activation, finalized: false };
            }

            const key = await tx.key.upsert({
                where: { code: codes[0] },
                update: { status: "SOLD", isVerified: true },
                create: {
                    code: codes[0],
                    productId: job!.card.productId,
                    status: "SOLD",
                    isVerified: true,
                    transactionId: remote.id,
                },
            });
            const card = await tx.card.update({
                where: { id: currentCard.id },
                data: {
                    keyId: key.id,
                    isActivated: true,
                    activatedAt: new Date(),
                    version: { increment: 1 },
                    activationLock: false,
                    activationLockBy: null,
                    activationLockAt: null,
                },
            });
            const activationAmount =
                job!.card.denomination?.amount ?? job!.card.customAmount ?? 0;
            const activation = await tx.cardActivation.create({
                data: {
                    cardId: card.id,
                    storeId: card.storeId,
                    activatedBy: job!.userId!,
                    activationAmount,
                },
            });
            const cost = await resolveCost(
                job!.card.store.companyId,
                job!.card.productId,
                job!.card.denominationId,
                tx,
            );
            const debitAmount = cost?.amount ?? activationAmount;
            if (!(debitAmount > 0)) {
                throw conflict("No existe un costo válido para esta activación");
            }
            await debit({
                companyId: job!.card.store.companyId,
                amount: debitAmount,
                currency: cost?.currency ?? job!.card.denomination?.currency ?? "USD",
                description: `Activación ${job!.card.product.name} (${job!.card.uuid})`,
                createdById: job!.userId,
                cardActivationId: activation.id,
                tx,
            });
            await tx.activationAttempt.create({
                data: {
                    cardId: card.id,
                    userId: job!.userId!,
                    storeId: card.storeId,
                    companyId: job!.card.store.companyId,
                    success: true,
                },
            });
            await tx.activationJob.update({
                where: { id: job!.id },
                data: {
                    status: "COMPLETED",
                    fulfillmentStatus: "delivered",
                    deliveredCodes: codes,
                    nextRetryAt: null,
                    lastError: null,
                },
            });
            return { card, activation, finalized: true };
        });

        if (result.finalized) {
            await writeAuditLog({
                action: "ACTIVATION",
                userId: job.userId!,
                companyId: job.card.store.companyId,
                storeId: job.card.storeId,
                entityType: "Card",
                entityId: job.cardId,
                after: { isActivated: true, fulfillmentRequestId: remote.id },
                details: { jobId: job.id, cardUuid: job.card.uuid },
                success: true,
            });
        }
        return {
            status: "COMPLETED",
            jobId: job.id,
            activation: result.activation,
            card: {
                uuid: job.card.uuid,
                product: job.card.product.name,
                store: job.card.store.name,
            },
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : "UNKNOWN";
        await prisma.activationJob.update({
            where: { id: job.id },
            data: {
                attempts: { increment: 1 },
                lastError: message.slice(0, 1000),
                nextRetryAt: new Date(Date.now() + RETRY_DELAY_MS),
            },
        }).catch(() => undefined);
        throw error;
    }
}

export async function activateCard(params: {
    qr: string;
    userId: string;
    ipAddress?: string | null;
    userAgent?: string | null;
    deviceId?: string | null;
}) {
    await checkRateLimit({ userId: params.userId, action: "ACTIVATION" });
    const uuid = extractUuid(params.qr);
    const card = await prisma.card.findUnique({
        where: { uuid },
        include: {
            store: true,
            product: true,
            denomination: true,
        },
    });
    if (!card) throw notFound("Tarjeta no encontrada.");
    if (!card.store.isActive) throw forbidden("Tienda inactiva.");
    if (!card.product.isActive) throw forbidden("Producto inactivo.");
    if (card.isActivated) throw conflict("Esta tarjeta ya está activada.");
    if (!(card.denomination?.devDiemProductId ?? card.product.devDiemProductId)) {
        throw conflict("El producto no está mapeado al catálogo de Diem");
    }
    const user = await assertCanActivateCard({
        userId: params.userId,
        storeId: card.storeId,
        companyId: card.store.companyId,
    });
    const configuredCost = await resolveCost(
        card.store.companyId,
        card.productId,
        card.denominationId,
    );
    const fallbackAmount = card.denomination?.amount ?? card.customAmount;
    if (!((configuredCost?.amount ?? fallbackAmount ?? 0) > 0)) {
        throw conflict("No existe un costo válido para esta activación");
    }

    const job = await prisma.$transaction(async (tx) => {
        const existing = await tx.activationJob.findFirst({
            where: {
                cardId: card.id,
                status: { in: ["PENDING", "PROCESSING", "AWAITING_STOCK", "ACTION_REQUIRED"] },
            },
            orderBy: { createdAt: "desc" },
        });
        if (existing) return existing;
        const locked = await tx.card.updateMany({
            where: { id: card.id, isActivated: false, activationLock: false },
            data: {
                activationLock: true,
                activationLockBy: user.id,
                activationLockAt: new Date(),
                activationAttempts: { increment: 1 },
                lastActivationAttempt: new Date(),
            },
        });
        if (!locked.count) throw conflict("La tarjeta ya está siendo procesada.");
        return tx.activationJob.create({
            data: {
                cardId: card.id,
                userId: user.id,
                storeId: card.storeId,
                status: "PENDING",
                idempotencyKey: `diem-sas-activation:${crypto.randomUUID()}`,
            },
        });
    });

    try {
        const processed = await processActivationJob(job.id);
        if (processed.status === "COMPLETED") {
            return { success: true, ...processed };
        }
    } catch {
        // The durable worker retries; the HTTP request must not perform an unsafe rollback.
    }
    return {
        success: true,
        processing: true,
        jobId: job.id,
        message: "Activación recibida. Diem está asignando el código.",
        card: { uuid: card.uuid, product: card.product.name, store: card.store.name },
    };
}
