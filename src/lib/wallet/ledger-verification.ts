import { rebuildBalances, type LedgerRow } from "./ledger.ts";

export type VerifiableWallet = {
    id: string;
    companyId: string;
    balance: number;
    rows: Array<LedgerRow & { balanceAfter: number | null }>;
};

export type VerifiablePurchase = {
    id: string;
    status: string;
    totalAmount: number;
    /** Wallet movements linked to the purchase that are not FAILED. */
    activeConsumptions: number;
    /** FAILED movements still linked: kept as audit evidence of a reclassification. */
    failedConsumptions: number;
    /** Active REFUND movements reversing this purchase's consumption. */
    reversals?: number;
};

/**
 * The debit path only ever writes CONFIRMED or PENDING movements, so a
 * COMPLETED purchase whose only linked movements are FAILED was excluded from
 * the active ledger on purpose (an audited reconciliation). It is reported,
 * not alerted.
 */
export type LedgerExclusion = { purchaseId: string; failedConsumptions: number };

export type LedgerFinding =
    | { kind: "WALLET_BALANCE_DRIFT"; walletId: string; companyId: string; stored: number; rebuilt: number }
    | { kind: "BALANCE_AFTER_DRIFT"; walletId: string; transactionId: string; stored: number | null; rebuilt: number }
    | { kind: "COMPLETED_PURCHASE_WITHOUT_ONE_CONSUMPTION"; purchaseId: string; consumptions: number }
    | { kind: "UNSETTLED_PURCHASE_WITH_CONSUMPTION"; purchaseId: string; status: string; consumptions: number }
    | { kind: "REVERSED_PURCHASE_NOT_REFUNDED_ONCE"; purchaseId: string; consumptions: number; reversals: number }
    | { kind: "COMPLETED_PURCHASE_REFUNDED"; purchaseId: string; reversals: number };

const differs = (a: number | null, b: number) => a === null || Math.abs(a - b) > 0.005;

/**
 * Invariants of the prepaid wallet ledger:
 * - each wallet balance equals the rebuild of its active ledger,
 * - each confirmed movement stores the running balance the rebuild yields,
 * - a COMPLETED purchase owns exactly one active consumption and no refund,
 * - a REVERSED purchase (cancelled by Diem after delivery) has every active
 *   consumption refunded exactly once, so it nets to zero,
 * - any other purchase owns no consumption.
 */
export function verifyLedger(
    wallets: VerifiableWallet[],
    purchases: VerifiablePurchase[],
): { findings: LedgerFinding[]; exclusions: LedgerExclusion[] } {
    const findings: LedgerFinding[] = [];
    const exclusions: LedgerExclusion[] = [];
    for (const wallet of wallets) {
        const rebuilt = rebuildBalances(wallet.rows);
        if (differs(wallet.balance, rebuilt.balance)) {
            findings.push({
                kind: "WALLET_BALANCE_DRIFT",
                walletId: wallet.id,
                companyId: wallet.companyId,
                stored: wallet.balance,
                rebuilt: rebuilt.balance,
            });
        }
        for (const row of wallet.rows) {
            const expected = rebuilt.balances.get(row.id);
            if (expected !== undefined && differs(row.balanceAfter, expected)) {
                findings.push({
                    kind: "BALANCE_AFTER_DRIFT",
                    walletId: wallet.id,
                    transactionId: row.id,
                    stored: row.balanceAfter,
                    rebuilt: expected,
                });
            }
        }
    }
    for (const purchase of purchases) {
        const reversals = purchase.reversals ?? 0;
        if (purchase.status === "REVERSED") {
            if (purchase.activeConsumptions !== reversals) {
                findings.push({
                    kind: "REVERSED_PURCHASE_NOT_REFUNDED_ONCE",
                    purchaseId: purchase.id,
                    consumptions: purchase.activeConsumptions,
                    reversals,
                });
            }
            continue;
        }
        if (purchase.status === "COMPLETED" && reversals > 0) {
            findings.push({ kind: "COMPLETED_PURCHASE_REFUNDED", purchaseId: purchase.id, reversals });
        }
        if (purchase.status === "COMPLETED") {
            if (purchase.activeConsumptions === 0 && purchase.failedConsumptions > 0) {
                exclusions.push({ purchaseId: purchase.id, failedConsumptions: purchase.failedConsumptions });
            } else if (purchase.totalAmount > 0 && purchase.activeConsumptions !== 1) {
                findings.push({
                    kind: "COMPLETED_PURCHASE_WITHOUT_ONE_CONSUMPTION",
                    purchaseId: purchase.id,
                    consumptions: purchase.activeConsumptions,
                });
            }
        } else if (purchase.activeConsumptions > 0) {
            findings.push({
                kind: "UNSETTLED_PURCHASE_WITH_CONSUMPTION",
                purchaseId: purchase.id,
                status: purchase.status,
                consumptions: purchase.activeConsumptions,
            });
        }
    }
    return { findings, exclusions };
}
