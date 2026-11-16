import type { Prisma } from "@prisma/client";

import { AppError } from "@/lib/errors";
import { rebuildBalances } from "@/lib/wallet/ledger";

/**
 * Recomputes every running balance of a wallet and its stored balance from
 * the effective-time order of its movements. Run inside the transaction that
 * changed the ledger, so a movement placed in the past never leaves later
 * balances stale.
 */
export async function ledgerRows(tx: Prisma.TransactionClient, walletId: string) {
    return tx.walletTransaction.findMany({
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
}

/**
 * Serializes accounting operations that can change statement ownership or
 * close a wallet period. Multiple wallets are always locked by id to avoid
 * deadlocks. Transaction-scoped advisory locks release on commit or rollback.
 */
export async function lockWalletAccounting(tx: Prisma.TransactionClient, walletIds: string[]) {
    for (const walletId of [...new Set(walletIds)].sort()) {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`wallet-accounting:${walletId}`}))`;
    }
}

/**
 * A stored balance that its movements do not explain (drift) must be
 * reconciled explicitly; a rebuild would silently replace it. Checked before
 * any write that rebuilds the ledger.
 */
export async function assertLedgerConsistent(tx: Prisma.TransactionClient, walletId: string, storedBalance: number) {
    const rebuilt = rebuildBalances(await ledgerRows(tx, walletId)).balance;
    if (Math.abs(rebuilt - storedBalance) > 0.005) {
        throw new AppError(
            "El saldo de la wallet no coincide con sus movimientos; concílialo antes de registrar abonos",
            409,
            "LEDGER_DRIFT",
            { stored: storedBalance, rebuilt },
        );
    }
}

export async function rebuildWalletLedger(tx: Prisma.TransactionClient, walletId: string) {
    const rows = await ledgerRows(tx, walletId);
    const rebuilt = rebuildBalances(rows);
    for (const row of rows) {
        const balanceAfter = rebuilt.balances.get(row.id);
        if (balanceAfter !== undefined && balanceAfter !== row.balanceAfter) {
            await tx.walletTransaction.update({ where: { id: row.id }, data: { balanceAfter }, select: { id: true } });
        }
    }
    await tx.wallet.update({ where: { id: walletId }, data: { balance: rebuilt.balance }, select: { id: true } });
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
