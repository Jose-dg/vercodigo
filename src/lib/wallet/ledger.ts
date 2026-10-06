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
