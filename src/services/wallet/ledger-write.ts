import type { Prisma } from "@prisma/client";

import { AppError } from "@/lib/errors";
import { rebuildBalances } from "@/lib/wallet/ledger";

/**
 * Recomputes every running balance of a wallet and its stored balance from
 * the effective-time order of its movements. Run inside the transaction that
 * changed the ledger, so a movement placed in the past never leaves later
 * balances stale.
 */
export async function rebuildWalletLedger(tx: Prisma.TransactionClient, walletId: string) {
    const rows = await tx.walletTransaction.findMany({
        where: { walletId },
        orderBy: [{ occurredAt: "asc" }, { occurredSequence: "asc" }, { id: "asc" }],
        select: {
            id: true,
            type: true,
            status: true,
            amount: true,
            balanceAfter: true,
            occurredAt: true,
            occurredSequence: true,
        },
    });
    const rebuilt = rebuildBalances(rows);
    for (const row of rows) {
        const balanceAfter = rebuilt.balances.get(row.id);
        if (balanceAfter !== undefined && balanceAfter !== row.balanceAfter) {
            await tx.walletTransaction.update({ where: { id: row.id }, data: { balanceAfter } });
        }
    }
    await tx.wallet.update({ where: { id: walletId }, data: { balance: rebuilt.balance } });
    return rebuilt.balance;
}

/**
 * Issued account statements are immutable and the next one starts after the
 * last issued line, so a movement dated inside an issued period would never be
 * reported. It is rejected instead of being re-dated.
 */
export async function assertOpenPeriod(tx: Prisma.TransactionClient, walletId: string, occurredAt: Date) {
    const latest = await tx.accountStatement.findFirst({
        where: { walletId },
        orderBy: [{ periodEnd: "desc" }, { issuedAt: "desc" }],
        select: { statementNumber: true, periodEnd: true },
    });
    if (latest && occurredAt <= latest.periodEnd) {
        throw new AppError(
            `La fecha del movimiento cae en un periodo ya cerrado por el estado de cuenta ${latest.statementNumber}`,
            409,
            "PERIOD_CLOSED",
            { statementNumber: latest.statementNumber, periodEnd: latest.periodEnd.toISOString() },
        );
    }
}
