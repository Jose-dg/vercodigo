import type { Prisma } from "@prisma/client";

import { SETTLED_FULFILLMENT_STATUSES, isSettledFulfillmentStatus } from "./fulfillment-lifecycle.ts";

/**
 * CodePurchase lifecycle. Open states move freely between each other while
 * Diem fulfils the request; COMPLETED and FAILED are absorbing.
 *
 * Every write that can race with another processor (inline checkout, partner
 * webhook, manual retry, recovery job) is a compare-and-set on "still open".
 * PostgreSQL locks the row and re-evaluates the WHERE clause, so a late
 * processor can never reopen, fail or re-debit a settled purchase.
 */
export const OPEN_CODE_PURCHASE_STATUSES = [
    "PENDING",
    "AWAITING_STOCK",
    "ACTION_REQUIRED",
    // Legacy rows only: the current flow settles inside one transaction and
    // never commits an intermediate FINALIZING state.
    "FINALIZING",
] as const;

export type OpenCodePurchaseStatus = typeof OPEN_CODE_PURCHASE_STATUSES[number];
export type CodePurchaseStatus = OpenCodePurchaseStatus | typeof SETTLED_FULFILLMENT_STATUSES[number];

type CodePurchaseWriter = {
    codePurchase: {
        updateMany(args: {
            where: Prisma.CodePurchaseWhereInput;
            data: Prisma.CodePurchaseUpdateManyMutationInput;
        }): Promise<{ count: number }>;
    };
};

export function isOpenCodePurchaseStatus(status: string): status is OpenCodePurchaseStatus {
    return (OPEN_CODE_PURCHASE_STATUSES as readonly string[]).includes(status);
}

export function canTransitionCodePurchase(from: string, to: string): boolean {
    if (isSettledFulfillmentStatus(from)) return false;
    if (!isOpenCodePurchaseStatus(from)) return false;
    // FINALIZING is never a target: settlement is a single atomic step.
    return to !== "FINALIZING" && (isOpenCodePurchaseStatus(to) || isSettledFulfillmentStatus(to));
}

/**
 * Applies `data` only while the purchase is still open. Returns false when
 * another processor already settled it; callers must then re-read and return
 * the settled state instead of treating it as an error.
 */
export async function updateOpenCodePurchase(
    db: CodePurchaseWriter,
    id: string,
    data: Prisma.CodePurchaseUpdateManyMutationInput & { status?: CodePurchaseStatus },
): Promise<boolean> {
    if (data.status === "FINALIZING") {
        throw new Error("FINALIZING is not a valid CodePurchase transition target");
    }
    const result = await db.codePurchase.updateMany({
        where: { id, status: { in: [...OPEN_CODE_PURCHASE_STATUSES] } },
        data,
    });
    return result.count === 1;
}
