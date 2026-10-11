import crypto from "crypto";

import prisma from "@/lib/prisma";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import {
    buildCommercialAccountCode,
    createCodeRequest,
    getCodeRequest,
    isDiemContractError,
    revealCodeRequest,
} from "@/lib/devdiem/fulfillment";
import { assertCanActivateCard } from "./permissions.service";
import { checkRateLimit } from "./rate-limit.service";
import { writeAuditLog } from "./audit.service";
import { debit } from "@/services/wallet/wallet.service";
import { resolveCost } from "@/services/costing/costing.service";
import {
    resolveCardDenomination,
    resolveDevDiemProductId,
} from "@/lib/devdiem/resolve-card-catalog";
import { isSettledFulfillmentStatus } from "./fulfillment-lifecycle";
import { OPEN_ACTIVATION_JOB_STATUSES } from "@/lib/codes/fulfillment-order";

type ActivationJobWriter = Pick<typeof prisma, "activationJob">;

export async function updateOpenActivationJob(
    db: ActivationJobWriter,
    id: string,
    data: Parameters<typeof prisma.activationJob.updateMany>[0]["data"],
) {
    const result = await db.activationJob.updateMany({
        where: { id, status: { in: OPEN_ACTIVATION_JOB_STATUSES } },
        data,
    });
    return result.count === 1;
}

export function extractCardUuid(qr: string): string {
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
                    product: { include: { denominations: true } },
                    denomination: true,
                    store: { include: { company: true } },
                },
            },
        },
    });
    if (!job) throw notFound("Trabajo de activación no encontrado");
    if (isSettledFulfillmentStatus(job.status)) return { status: job.status, job };
    if (!job.userId) throw conflict("El trabajo no tiene usuario responsable");

    const effectiveDenomination = resolveCardDenomination(job.card);
    const remoteProductId = resolveDevDiemProductId(job.card);
    if (!remoteProductId) throw conflict("El producto no está mapeado al catálogo de Diem");
    const actor = await prisma.user.findUnique({
        where: { id: job.userId },
        select: { email: true, name: true },
    });
    if (!actor?.email) throw conflict("El usuario necesita un email");

    if (!(job.commercialAmount && job.commercialAmount > 0) || !job.commercialCurrency) {
        const configuredCost = await resolveCost(
            job.card.store.companyId,
            job.card.productId,
            effectiveDenomination?.id ?? job.card.denominationId,
        );
        const fallbackAmount = effectiveDenomination?.amount ?? job.card.customAmount;
        const commercialAmount = configuredCost?.amount ?? fallbackAmount ?? 0;
        if (!(commercialAmount > 0)) {
            throw conflict("No existe un costo válido para esta activación");
        }
        job = await prisma.activationJob.update({
            where: { id: job.id },
            data: {
                commercialAmount,
                commercialCurrency:
                    configuredCost?.currency ?? effectiveDenomination?.currency ?? "USD",
                sourceAmount: configuredCost?.sourceAmount ?? null,
                sourceCurrency: configuredCost?.sourceCurrency ?? null,
                appliedExchangeRate: configuredCost?.exchangeRate ?? null,
            },
            include: {
                card: {
                    include: {
                        product: { include: { denominations: true } },
                        denomination: true,
                        store: { include: { company: true } },
                    },
                },
            },
        });
    }

    try {
        if (!job.diemRequestId) {
            const [firstName, ...lastName] = (actor.name || actor.email).trim().split(/\s+/);
            const remote = await createCodeRequest({
                idempotencyKey: job.idempotencyKey,
                externalReference: `DIEM-SAS-ACTIVATION-${job.id}`,
                correlationId: `card-activation:${job.id}`,
                source: "physical_card",
                productId: remoteProductId,
                quantity: 1,
                recipient: {
                    firstName,
                    lastName: lastName.join(" "),
                    email: actor.email,
                },
                commercial: {
                    accountCode: buildCommercialAccountCode(job.card.store.companyId),
                    referenceNamespace: "card_activation",
                    currencyCode: job.commercialCurrency!,
                    unitPrice: job.commercialAmount!,
                    totalAmount: job.commercialAmount!,
                },
                metadata: {
                    activation_job_id: job.id,
                    card_uuid: job.card.uuid,
                    company_id: job.card.store.companyId,
                    store_id: job.card.storeId,
                },
            });
            const linked = await prisma.activationJob.updateMany({
                where: {
                    id: job.id,
                    status: { in: OPEN_ACTIVATION_JOB_STATUSES },
                    OR: [{ diemRequestId: null }, { diemRequestId: remote.id }],
                },
                data: {
                    diemRequestId: remote.id,
                    fulfillmentStatus: remote.status,
                    status: "PROCESSING",
                    attempts: { increment: 1 },
                    nextRetryAt: null,
                    lastError: null,
                },
            });
            job = await prisma.activationJob.findUniqueOrThrow({
                where: { id: job.id },
                include: {
                    card: {
                        include: {
                            product: { include: { denominations: true } },
                            denomination: true,
                            store: { include: { company: true } },
                        },
                    },
                },
            });
            if (!linked.count) {
                if (isSettledFulfillmentStatus(job.status)) return { status: job.status, jobId: job.id };
                throw conflict("La activación ya está vinculada a otra solicitud de Diem");
            }
        }

        const persistedCodes = Array.isArray(job.deliveredCodes)
            ? job.deliveredCodes.filter((code): code is string => typeof code === "string")
            : [];
        // Always revalidate the remote commercial link before reveal or debit,
        // including retries that already persisted the delivered code.
        const remote = await getCodeRequest(job.diemRequestId!);
        if (["failed", "cancelled"].includes(remote.status)) {
            const failed = await prisma.$transaction(async (tx) => {
                const applied = await updateOpenActivationJob(tx, job!.id, {
                    status: "FAILED",
                    fulfillmentStatus: remote.status,
                    lastError: `Fulfillment terminó en ${remote.status}`,
                    nextRetryAt: null,
                });
                // Only the processor that failed the job releases the card lock.
                if (applied) {
                    await tx.card.update({
                        where: { id: job!.cardId },
                        data: {
                            activationLock: false,
                            activationLockBy: null,
                            activationLockAt: null,
                        },
                    });
                }
                return applied;
            });
            if (!failed) {
                const settled = await prisma.activationJob.findUniqueOrThrow({
                    where: { id: job.id },
                    select: { status: true },
                });
                return { status: settled.status, jobId: job.id };
            }
            return { status: "FAILED", jobId: job.id };
        }
        if (remote.status === "action_required" || remote.status === "pending_review") {
            await updateOpenActivationJob(prisma, job.id, {
                status: "ACTION_REQUIRED",
                fulfillmentStatus: remote.status,
                ...(remote.status === "pending_review"
                    ? { lastError: "Diem exige revisión manual de esta solicitud. No se debitó la wallet." }
                    : {}),
                nextRetryAt: null,
            });
            return { status: "ACTION_REQUIRED", jobId: job.id };
        }
        if (!["allocated", "delivered", "partially_delivered"].includes(remote.status)) {
            await updateOpenActivationJob(prisma, job.id, {
                status: remote.status === "awaiting_stock" ? "AWAITING_STOCK" : "PROCESSING",
                fulfillmentStatus: remote.status,
                nextRetryAt: null,
            });
            return { status: remote.status, jobId: job.id };
        }

        const codes = persistedCodes.length === 1
            ? persistedCodes
            : await revealCodeRequest(remote.id, `activation-job:${job.id}`);
        if (codes.length !== 1) throw new Error(`Diem reveló ${codes.length} códigos; se esperaba 1`);
        if (persistedCodes.length !== 1) {
            const stored = await updateOpenActivationJob(prisma, job.id, {
                deliveredCodes: codes,
                fulfillmentStatus: "delivered",
                nextRetryAt: null,
                lastError: null,
            });
            job = await prisma.activationJob.findUniqueOrThrow({
                where: { id: job.id },
                include: {
                    card: {
                        include: {
                            product: { include: { denominations: true } },
                            denomination: true,
                            store: { include: { company: true } },
                        },
                    },
                },
            });
            if (!stored) return { status: job.status, jobId: job.id };
        }

        const result = await prisma.$transaction(async (tx) => {
            const claimed = await tx.activationJob.updateMany({
                where: { id: job!.id, status: { in: OPEN_ACTIVATION_JOB_STATUSES } },
                data: {
                    status: "COMPLETED",
                    fulfillmentStatus: "delivered",
                    deliveredCodes: codes,
                    nextRetryAt: null,
                    lastError: null,
                },
            });
            const currentCard = await tx.card.findUniqueOrThrow({ where: { id: job!.cardId } });
            if (!claimed.count || currentCard.isActivated) {
                const activation = await tx.cardActivation.findUnique({ where: { cardId: currentCard.id } });
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
                effectiveDenomination?.amount ?? job!.card.customAmount ?? 0;
            const activation = await tx.cardActivation.create({
                data: {
                    cardId: card.id,
                    storeId: card.storeId,
                    activatedBy: job!.userId!,
                    activationAmount,
                    commercialAmount: job!.commercialAmount,
                    commercialCurrency: job!.commercialCurrency,
                    sourceAmount: job!.sourceAmount,
                    sourceCurrency: job!.sourceCurrency,
                    appliedExchangeRate: job!.appliedExchangeRate,
                },
            });
            const debitAmount = job!.commercialAmount ?? 0;
            if (!(debitAmount > 0) || !job!.commercialCurrency) {
                throw conflict("No existe un costo válido para esta activación");
            }
            await debit({
                companyId: job!.card.store.companyId,
                amount: debitAmount,
                currency: job!.commercialCurrency,
                description: `Activación ${job!.card.product.name} (${job!.card.uuid})`,
                createdById: job!.userId,
                cardActivationId: activation.id,
                sourceAmount: job!.sourceAmount ?? undefined,
                sourceCurrency: job!.sourceCurrency ?? undefined,
                appliedExchangeRate: job!.appliedExchangeRate ?? undefined,
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
        const permanent = isDiemContractError(error) && !job.diemRequestId;
        await prisma.$transaction(async (tx) => {
            const applied = await updateOpenActivationJob(tx, job!.id, {
                attempts: { increment: 1 },
                lastError: message.slice(0, 1000),
                nextRetryAt: null,
                ...(permanent ? { status: "FAILED" as const } : {}),
            });
            if (applied && permanent) {
                await tx.card.update({
                    where: { id: job!.cardId },
                    data: {
                        activationLock: false,
                        activationLockBy: null,
                        activationLockAt: null,
                    },
                });
            }
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
    quotedAmount?: number;
    quotedCurrency?: string;
    quotedRate?: number | null;
}) {
    await checkRateLimit({ userId: params.userId, action: "ACTIVATION" });
    const uuid = extractCardUuid(params.qr);
    const card = await prisma.card.findUnique({
        where: { uuid },
        include: {
            store: true,
            product: { include: { denominations: true } },
            denomination: true,
        },
    });
    if (!card) throw notFound("Tarjeta no encontrada.");
    if (!card.store.isActive) throw forbidden("Tienda inactiva.");
    if (!card.product.isActive) throw forbidden("Producto inactivo.");
    if (card.isActivated) throw conflict("Esta tarjeta ya está activada.");
    const effectiveDenomination = resolveCardDenomination(card);
    if (!resolveDevDiemProductId(card)) {
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
        effectiveDenomination?.id ?? card.denominationId,
    );
    const fallbackAmount = effectiveDenomination?.amount ?? card.customAmount;
    if (!((configuredCost?.amount ?? fallbackAmount ?? 0) > 0)) {
        throw conflict("No existe un costo válido para esta activación");
    }
    const billingAmount = configuredCost?.amount ?? fallbackAmount!;
    const billingCurrency = configuredCost?.currency ?? effectiveDenomination?.currency ?? "USD";
    if (
        params.quotedAmount != null
        && (
            Math.abs(params.quotedAmount - billingAmount) > 0.005
            || params.quotedCurrency?.toUpperCase() !== billingCurrency.toUpperCase()
            || (params.quotedRate != null
                && (configuredCost?.exchangeRate == null
                    || Math.abs(params.quotedRate - configuredCost.exchangeRate) > 0.0001))
        )
    ) {
        throw conflict("La tarifa cambió después de mostrar el total. Revisa el valor y confirma nuevamente.");
    }

    const job = await prisma.$transaction(async (tx) => {
        const existing = await tx.activationJob.findFirst({
            where: {
                cardId: card.id,
                status: { in: OPEN_ACTIVATION_JOB_STATUSES },
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
                commercialAmount: billingAmount,
                commercialCurrency: billingCurrency,
                sourceAmount: configuredCost?.sourceAmount ?? null,
                sourceCurrency: configuredCost?.sourceCurrency ?? null,
                appliedExchangeRate: configuredCost?.exchangeRate ?? null,
            },
        });
    });

    const cardSummary = {
        uuid: card.uuid,
        product: card.product.name,
        store: card.store.name,
    };
    try {
        const processed = await processActivationJob(job.id);
        if (processed.status === "COMPLETED") {
            return { success: true as const, ...processed };
        }
        if (processed.status === "FAILED" || processed.status === "ACTION_REQUIRED") {
            const latest = await prisma.activationJob.findUnique({
                where: { id: job.id },
                select: { lastError: true, status: true },
            });
            return {
                success: false,
                processing: false,
                jobId: job.id,
                status: processed.status,
                message:
                    latest?.lastError
                    || "La activación no se pudo completar. Revisa la cuenta comercial o el catálogo en Diem.",
                card: cardSummary,
            };
        }
    } catch (error) {
        const latest = await prisma.activationJob.findUnique({
            where: { id: job.id },
            select: { lastError: true, status: true },
        });
        if (latest?.status === "FAILED" || isDiemContractError(error)) {
            return {
                success: false,
                processing: false,
                jobId: job.id,
                status: latest?.status ?? "FAILED",
                message:
                    latest?.lastError
                    || (error instanceof Error ? error.message : "La activación falló."),
                card: cardSummary,
            };
        }
        // Transient Diem pressure: the job is durable. Webhook or retry continues it.
    }
    return {
        success: true,
        processing: true,
        jobId: job.id,
        message: "Activación recibida. Diem está asignando el código.",
        card: cardSummary,
    };
}

export async function previewCardActivation(params: { qr: string; userId: string }) {
    const uuid = extractCardUuid(params.qr);
    const card = await prisma.card.findUnique({
        where: { uuid },
        include: {
            store: { include: { company: true } },
            product: { include: { denominations: true } },
            denomination: true,
        },
    });
    if (!card) throw notFound("Tarjeta no encontrada.");
    if (!card.store.isActive) throw forbidden("Tienda inactiva.");
    if (!card.product.isActive) throw forbidden("Producto inactivo.");
    if (card.isActivated) throw conflict("Esta tarjeta ya está activada.");

    const preview = {
        uuid: card.uuid,
        product: card.product.name,
        store: card.store.name,
        company: card.store.company.name,
        amount: resolveCardDenomination(card)?.amount ?? card.customAmount,
        currency: resolveCardDenomination(card)?.currency ?? card.denomination?.currency ?? null,
        billingAmount: null as number | null,
        billingCurrency: null as string | null,
        appliedExchangeRate: null as number | null,
        canActivate: true as boolean,
        blockReason: null as string | null,
    };

    if (!resolveDevDiemProductId(card)) {
        preview.canActivate = false;
        preview.blockReason = "El producto no está mapeado al catálogo de Diem";
        return preview;
    }

    const configuredCost = await resolveCost(
        card.store.companyId,
        card.productId,
        resolveCardDenomination(card)?.id ?? card.denominationId,
    );
    const fallbackAmount = resolveCardDenomination(card)?.amount ?? card.customAmount;
    preview.billingAmount = configuredCost?.amount ?? fallbackAmount ?? null;
    preview.billingCurrency = configuredCost?.currency
        ?? resolveCardDenomination(card)?.currency
        ?? card.denomination?.currency
        ?? null;
    preview.appliedExchangeRate = configuredCost?.exchangeRate ?? null;
    if (!((configuredCost?.amount ?? fallbackAmount ?? 0) > 0)) {
        preview.canActivate = false;
        preview.blockReason = "No existe un costo válido para esta activación";
        return preview;
    }

    try {
        await assertCanActivateCard({
            userId: params.userId,
            storeId: card.storeId,
            companyId: card.store.companyId,
        });
    } catch (error) {
        preview.canActivate = false;
        preview.blockReason = error instanceof Error ? error.message : "No tienes permisos para esta tarjeta";
    }

    return preview;
}
