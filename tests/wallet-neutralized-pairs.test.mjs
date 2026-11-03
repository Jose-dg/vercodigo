import assert from "node:assert/strict";
import test from "node:test";

import { customerRunningBalances } from "../src/lib/wallet/customer-visibility.ts";

const movement = (id, type, amount, balanceAfter, occurredAt) => ({
    id,
    type,
    amount,
    balanceAfter,
    occurredAt: new Date(occurredAt),
    occurredSequence: 0,
});

test("neutralized debit and refund never distort customer running balances", () => {
    const hidden = [
        movement("debit", "CONSUMPTION", 78_750, 921_250, "2026-10-29T19:14:00Z"),
        movement("refund", "REFUND", 78_750, 950_000, "2026-11-03T14:00:00Z"),
    ];
    const visible = [
        movement("between", "CONSUMPTION", 50_000, 871_250, "2026-10-31T22:47:00Z"),
        movement("after", "CONSUMPTION", 10_000, 940_000, "2026-11-03T15:00:00Z"),
    ];

    const balances = customerRunningBalances(visible, hidden);
    assert.equal(balances.get("between"), 950_000);
    assert.equal(balances.get("after"), 940_000);
});
