import { createHash } from "node:crypto";

import { normalizeBankReference } from "./effective-time.ts";

/**
 * Identity of a manual top-up request behind an Idempotency-Key. Reusing the
 * key with a different company, amount, payment time or reference is a
 * conflict, never a second credit.
 */
export function manualRechargeFingerprint(params: {
    companyId: string;
    amount: number;
    occurredAt: Date;
    externalReference: string;
}): string {
    return createHash("sha256")
        .update(JSON.stringify([
            params.companyId,
            params.amount.toFixed(2),
            params.occurredAt.toISOString(),
            normalizeBankReference(params.externalReference),
        ]))
        .digest("hex");
}
