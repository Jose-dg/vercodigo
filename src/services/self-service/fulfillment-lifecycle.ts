/**
 * Two local facts, not one "terminal" flag:
 *
 * Settlement: codes and wallet are finished (COMPLETED), dead (FAILED) or
 * undone after delivery (REVERSED: Diem cancelled a delivered request and the
 * wallet consumption was refunded).
 * Wait: the UI must stop calling Diem. ACTION_REQUIRED is a wait: an operator
 * in Diem has to approve; the webhook resumes reveal and debit.
 */

export const SETTLED_FULFILLMENT_STATUSES = ["COMPLETED", "FAILED", "REVERSED"] as const;

export function isSettledFulfillmentStatus(status: string): boolean {
    return (SETTLED_FULFILLMENT_STATUSES as readonly string[]).includes(status);
}

export function isFulfillmentWaitLocal(status: string): boolean {
    return isSettledFulfillmentStatus(status) || status === "ACTION_REQUIRED";
}
