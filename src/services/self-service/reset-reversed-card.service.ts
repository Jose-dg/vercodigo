import { Prisma } from "@prisma/client";

import prisma from "@/lib/prisma";

type ResetParams = {
    cardUuid: string;
    expectedJobId: string;
    expectedRequestId: string;
    expectedColombiaPurchaseId: string;
    actorId: string;
    reason: string;
};

export async function previewReversedCardReset(params: ResetParams) {
    const card = await prisma.card.findUnique({
        where: { uuid: params.cardUuid },
        include: {
            activation: true,
            activationJobs: { orderBy: { createdAt: "asc" } },
            scanLogs: { orderBy: { scannedAt: "asc" } },
            activationAttemptLogs: true,
            invoiceItems: true,
            key: { select: { id: true, status: true } },
            product: { select: { id: true, name: true } },
            denomination: { select: { id: true, amount: true, countryRegion: true } },
            store: { include: { company: { include: { wallet: true } } } },
        },
    });
    if (!card) throw new Error("La tarjeta no existe");
    const job = card.activationJobs.find((row) => row.id === params.expectedJobId);
    if (!job || job.diemRequestId !== params.expectedRequestId) {
        throw new Error("El job/request esperado no pertenece a la tarjeta");
    }
    if (job.status !== "REVERSED" || job.fulfillmentStatus !== "cancelled") {
        throw new Error(`La activación origen no está revertida (${job.status}/${job.fulfillmentStatus})`);
    }
    if (!card.activation || card.activation.invoiceId) {
        throw new Error("La activación histórica no existe o ya fue facturada");
    }
    if (!card.isActivated || card.isRedeemed || !card.keyId || !card.key) {
        throw new Error("La tarjeta no conserva la activación histórica esperada");
    }
    const successfulScans = card.scanLogs.filter((row) => row.wasSuccess).length;
    if (card.scanCount !== 1 || successfulScans !== 1) {
        throw new Error("La tarjeta no tiene exactamente el escaneo operativo confirmado");
    }
    if (card.invoiceItems.length) throw new Error("La tarjeta tiene ítems de factura");

    const consumption = await prisma.walletTransaction.findUnique({
        where: { cardActivationId: card.activation.id },
    });
    const refund = consumption
        ? await prisma.walletTransaction.findUnique({ where: { reversalOfId: consumption.id } })
        : null;
    if (!consumption || consumption.type !== "CONSUMPTION" || consumption.status !== "CONFIRMED") {
        throw new Error("No existe el consumo confirmado de la activación histórica");
    }
    if (!refund || refund.type !== "REFUND" || refund.status !== "CONFIRMED" || refund.amount !== consumption.amount) {
        throw new Error("No existe el REFUND completo y confirmado de la activación histórica");
    }

    const colombiaPurchase = await prisma.codePurchase.findUnique({
        where: { id: params.expectedColombiaPurchaseId },
        include: {
            denomination: true,
            keys: { select: { id: true, status: true } },
        },
    });
    const colombiaCharge = await prisma.walletTransaction.findUnique({
        where: { codePurchaseId: params.expectedColombiaPurchaseId },
    });
    if (
        !colombiaPurchase
        || colombiaPurchase.companyId !== card.store.companyId
        || colombiaPurchase.status !== "COMPLETED"
        || colombiaPurchase.fulfillmentStatus !== "delivered"
        || colombiaPurchase.totalAmount !== 110000
        || colombiaPurchase.currency !== "COP"
        || colombiaPurchase.denomination?.countryRegion !== "colombia"
        || colombiaPurchase.denomination.amount !== 25
    ) {
        throw new Error("La compra independiente Colombia de $110.000 no coincide con lo esperado");
    }
    if (
        !colombiaCharge
        || colombiaCharge.type !== "CONSUMPTION"
        || colombiaCharge.status !== "CONFIRMED"
        || colombiaCharge.amount !== 110000
    ) {
        throw new Error("El cobro Colombia de $110.000 no está confirmado");
    }

    const archiveUuid = `${card.uuid}-ARCH-${job.id.slice(-6).toUpperCase()}`;
    const existingArchive = await prisma.card.findUnique({ where: { uuid: archiveUuid } });
    return {
        card,
        job,
        consumption,
        refund,
        colombiaPurchase,
        colombiaCharge,
        archiveUuid,
        existingArchive,
        successfulScans,
    };
}

export async function resetReversedCard(params: ResetParams) {
    const reason = params.reason.trim();
    if (reason.length < 20) throw new Error("El motivo debe tener al menos 20 caracteres");
    const preview = await previewReversedCardReset(params);
    if (preview.existingArchive) throw new Error(`Ya existe el archivo ${preview.archiveUuid}`);

    return prisma.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
            SELECT id FROM "Card" WHERE id = ${preview.card.id} FOR UPDATE
        `);
        if (locked.length !== 1) throw new Error("No se pudo bloquear la tarjeta");
        const current = await tx.card.findUniqueOrThrow({
            where: { id: preview.card.id },
            include: { activation: true },
        });
        if (
            !current.isActivated
            || current.isRedeemed
            || current.keyId !== preview.card.keyId
            || current.activation?.id !== preview.card.activation?.id
            || current.version !== preview.card.version
        ) {
            throw new Error("La tarjeta cambió después del preflight; no se aplicó nada");
        }

        await tx.card.update({ where: { id: current.id }, data: { keyId: null } });
        const archived = await tx.card.create({
            data: {
                uuid: preview.archiveUuid,
                qrData: `archived:${params.cardUuid}:${params.expectedJobId}`,
                productId: current.productId,
                denominationId: current.denominationId,
                customAmount: current.customAmount,
                storeId: current.storeId,
                isActivated: true,
                isRedeemed: false,
                activatedAt: current.activatedAt,
                redeemedAt: null,
                scanCount: current.scanCount,
                maxScans: current.maxScans,
                activationLock: false,
                activationLockBy: null,
                activationLockAt: null,
                version: current.version,
                activationAttempts: current.activationAttempts,
                lastActivationAttempt: current.lastActivationAttempt,
                batchId: current.batchId,
                fabricationUnitCost: current.fabricationUnitCost,
                keyId: preview.card.keyId,
            },
        });
        await tx.cardActivation.update({
            where: { id: preview.card.activation!.id },
            data: { cardId: archived.id, billingStatus: "CANCELLED" },
        });
        await Promise.all([
            tx.activationJob.updateMany({ where: { cardId: current.id }, data: { cardId: archived.id } }),
            tx.activationAttempt.updateMany({ where: { cardId: current.id }, data: { cardId: archived.id } }),
            tx.scanLog.updateMany({ where: { cardId: current.id }, data: { cardId: archived.id } }),
            tx.invoiceItem.updateMany({ where: { cardId: current.id }, data: { cardId: archived.id } }),
        ]);
        const reset = await tx.card.update({
            where: { id: current.id },
            data: {
                isActivated: false,
                isRedeemed: false,
                activatedAt: null,
                redeemedAt: null,
                scanCount: 0,
                activationLock: false,
                activationLockBy: null,
                activationLockAt: null,
                activationAttempts: 0,
                lastActivationAttempt: null,
                version: { increment: 1 },
            },
        });
        await tx.auditLog.create({
            data: {
                action: "REVERSED_CARD_RESET",
                userId: params.actorId,
                companyId: preview.card.store.companyId,
                storeId: preview.card.storeId,
                entityType: "Card",
                entityId: current.id,
                before: {
                    uuid: params.cardUuid,
                    activationJobId: params.expectedJobId,
                    diemRequestId: params.expectedRequestId,
                    keyId: preview.card.keyId,
                },
                after: {
                    uuid: params.cardUuid,
                    keyId: null,
                    readyForActivation: true,
                    archivedCardId: archived.id,
                    archivedUuid: archived.uuid,
                },
                details: {
                    reason,
                    operatorOnlyScanConfirmed: true,
                    sourceRefundId: preview.refund.id,
                    preservedColombiaPurchaseId: params.expectedColombiaPurchaseId,
                    preservedColombiaChargeId: preview.colombiaCharge.id,
                },
            },
        });
        return { archived, reset };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
