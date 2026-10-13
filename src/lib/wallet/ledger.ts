export type LedgerRow = {
    id: string;
    type: "OPENING_BALANCE" | "RECHARGE" | "CONSUMPTION" | "ADJUSTMENT" | "REFUND";
    status: "PENDING" | "CONFIRMED" | "FAILED";
    amount: number;
    occurredAt: Date;
    occurredSequence: number;
};

/** Rebuild only the active ledger, starting at its latest confirmed opening. */
export function rebuildBalances(rows: LedgerRow[]): { balances: Map<string, number>; balance: number } {
    const ordered = [...rows].sort(
        (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime()
            || a.occurredSequence - b.occurredSequence
            || a.id.localeCompare(b.id),
    );
    const latestOpeningIndex = ordered.reduce(
        (latest, row, index) => row.status === "CONFIRMED" && row.type === "OPENING_BALANCE" ? index : latest,
        -1,
    );
    const activeRows = latestOpeningIndex >= 0 ? ordered.slice(latestOpeningIndex) : ordered;
    let balance = 0;
    const balances = new Map<string, number>();
    for (const row of activeRows) {
        if (row.status !== "CONFIRMED") continue;
        if (row.type === "OPENING_BALANCE") {
            balance = -Math.abs(row.amount);
        } else if (row.type === "RECHARGE" || row.type === "REFUND") {
            balance += row.amount;
        } else if (row.type === "CONSUMPTION") {
            balance -= row.amount;
        } else {
            balance += row.amount;
        }
        balance = Math.round(balance * 100) / 100;
        balances.set(row.id, balance);
    }
    return { balances, balance };
}

export type OccurredAtShiftLine = {
    id: string;
    type: LedgerRow["type"];
    amount: number;
    occurredAt: Date;
    balanceBefore: number | null;
    balanceAfter: number | null;
};

export type OccurredAtShift = {
    /** Movements whose running balance changes, in their new effective order. */
    lines: OccurredAtShiftLine[];
    finalBalanceBefore: number;
    finalBalanceAfter: number;
    /** Movements that were not negative and would be after the shift. */
    newlyNegative: number;
};

/**
 * What moving one movement to `newOccurredAt` does to the running balances.
 * Only intermediate balances may change: a different final balance means the
 * movement would leave the active ledger (e.g. moved before the opening).
 */
export function previewOccurredAtShift(rows: LedgerRow[], transactionId: string, newOccurredAt: Date): OccurredAtShift {
    const before = rebuildBalances(rows);
    const shifted = rows.map((row) => row.id === transactionId ? { ...row, occurredAt: newOccurredAt } : row);
    const after = rebuildBalances(shifted);
    const lines: OccurredAtShiftLine[] = [];
    let newlyNegative = 0;
    for (const id of new Set([...after.balances.keys(), ...before.balances.keys()])) {
        const balanceBefore = before.balances.get(id) ?? null;
        const balanceAfter = after.balances.get(id) ?? null;
        if (balanceBefore === balanceAfter) continue;
        const row = shifted.find((candidate) => candidate.id === id)!;
        lines.push({ id, type: row.type, amount: row.amount, occurredAt: row.occurredAt, balanceBefore, balanceAfter });
        if (balanceAfter !== null && balanceAfter < 0 && (balanceBefore === null || balanceBefore >= 0)) newlyNegative += 1;
    }
    return { lines, finalBalanceBefore: before.balance, finalBalanceAfter: after.balance, newlyNegative };
}
