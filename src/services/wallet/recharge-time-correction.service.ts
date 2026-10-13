import type { Prisma } from "@prisma/client";

import { badRequest, conflict, notFound } from "@/lib/errors";
import prisma from "@/lib/prisma";
import { runSerializableTransaction } from "@/lib/prisma-transaction";
import { effectiveTimeProblem, isCorrectableRecharge } from "@/lib/wallet/effective-time";
import { previewOccurredAtShift, type OccurredAtShift } from "@/lib/wallet/ledger";
import { assertLedgerConsistent, assertOpenPeriod, ledgerRows, rebuildWalletLedger } from "./ledger-write";

/**
 * Correction of the payment time of a manual top-up, mistyped when it was
 * registered. The time is the movement's effective time, so the running
 * balances between the old and the new time are rebuilt; the final balance
 * never changes. Issued account statements are immutable: a top-up already
 * reported, or a time inside a closed period, is rejected.
 */

async function loadCorrectable(tx: Prisma.TransactionClient, transactionId: string) {
    const movement = await tx.walletTransaction.findUnique({
        where: { id: transactionId },
        include: {
            wallet: { select: { id: true, companyId: true, balance: true } },
            accountStatementLine: { select: { accountStatement: { select: { statementNumber: true } } } },
        },
    });
    if (!movement) throw notFound("Movimiento no encontrado");
    if (!isCorrectableRecharge(movement)) {
        throw badRequest("Solo se corrige la hora de abonos manuales confirmados");
    }
    if (movement.accountStatementLine) {
        throw conflict(
            `El abono ya está en el estado de cuenta ${movement.accountStatementLine.accountStatement.statementNumber}; no se puede mover`,
            { statementNumber: movement.accountStatementLine.accountStatement.statementNumber },
        );
    }
    return movement;
}

async function plannedShift(
    tx: Prisma.TransactionClient,
    movement: Awaited<ReturnType<typeof loadCorrectable>>,
    paidAt: Date,
): Promise<OccurredAtShift> {
    const problem = effectiveTimeProblem({ occurredAt: paidAt, now: new Date() });
    if (problem) throw badRequest(problem);
    await assertOpenPeriod(tx, movement.walletId, movement.occurredAt);
    await assertOpenPeriod(tx, movement.walletId, paidAt);
    const shift = previewOccurredAtShift(await ledgerRows(tx, movement.walletId), movement.id, paidAt);
    if (Math.abs(shift.finalBalanceAfter - shift.finalBalanceBefore) > 0.005) {
        throw conflict("La nueva hora queda antes del saldo anterior de la wallet; ese abono dejaría de contar");
    }
    return shift;
}

export async function previewRechargeTimeCorrection(params: { transactionId: string; paidAt: Date }) {
    return runSerializableTransaction(prisma, async (tx) => {
        const movement = await loadCorrectable(tx, params.transactionId);
        const shift = await plannedShift(tx, movement, params.paidAt);
        return { transactionId: movement.id, previousOccurredAt: movement.occurredAt, occurredAt: params.paidAt, ...shift };
    });
}

export async function correctRechargeTime(params: {
    transactionId: string;
    paidAt: Date;
    /** The time the admin saw; a different current time means someone else changed it. */
    expectedOccurredAt: Date;
    reason: string;
    actorId: string;
}) {
    const reason = params.reason.trim();
    if (reason.length < 3 || reason.length > 500) throw badRequest("Indica por qué se corrige la hora del pago");

    return runSerializableTransaction(prisma, async (tx) => {
        const movement = await loadCorrectable(tx, params.transactionId);
        if (movement.occurredAt.getTime() !== params.expectedOccurredAt.getTime()) {
            throw conflict("La hora del abono cambió mientras la corregías; vuelve a cargarla");
        }
        if (movement.occurredAt.getTime() === params.paidAt.getTime()) {
            return { transaction: movement, changed: false };
        }
        await assertLedgerConsistent(tx, movement.walletId, movement.wallet.balance);
        const shift = await plannedShift(tx, movement, params.paidAt);

        await tx.walletTransaction.update({
            where: { id: movement.id },
            data: { occurredAt: params.paidAt },
        });
        await rebuildWalletLedger(tx, movement.walletId);
        await tx.auditLog.create({
            data: {
                action: "WALLET_RECHARGE_TIME_CORRECTED",
                userId: params.actorId,
                companyId: movement.wallet.companyId,
                entityType: "WalletTransaction",
                entityId: movement.id,
                before: { occurredAt: movement.occurredAt.toISOString() },
                after: { occurredAt: params.paidAt.toISOString() },
                details: {
                    reason,
                    externalReference: movement.externalReference,
                    rebalancedMovements: shift.lines.length,
                },
            },
        });
        const transaction = await tx.walletTransaction.findUniqueOrThrow({ where: { id: movement.id } });
        return { transaction, changed: true };
    });
}
