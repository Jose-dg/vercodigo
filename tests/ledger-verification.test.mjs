import assert from "node:assert/strict";
import test from "node:test";

import { verifyLedger } from "../src/lib/wallet/ledger-verification.ts";

const at = (minute) => new Date(Date.UTC(2026, 9, 1, 12, minute));
const row = (id, type, amount, balanceAfter, minute, status = "CONFIRMED") => ({
    id, type, status, amount, balanceAfter, occurredAt: at(minute), occurredSequence: 0,
});
const purchase = (id, status, active, failed = 0) => ({
    id, status, totalAmount: 100, activeConsumptions: active, failedConsumptions: failed,
});

test("a consistent ledger has no findings", () => {
    const { findings, exclusions } = verifyLedger(
        [{
            id: "w1",
            companyId: "c1",
            balance: -1100,
            rows: [row("o", "OPENING_BALANCE", 1000, -1000, 0), row("c", "CONSUMPTION", 100, -1100, 1)],
        }],
        [purchase("p1", "COMPLETED", 1), purchase("p2", "PENDING", 0)],
    );
    assert.deepEqual(findings, []);
    assert.deepEqual(exclusions, []);
});

test("detects wallet and running-balance drift", () => {
    const { findings } = verifyLedger(
        [{
            id: "w1",
            companyId: "c1",
            balance: -1200,
            rows: [row("o", "OPENING_BALANCE", 1000, -1000, 0), row("c", "CONSUMPTION", 100, -1150, 1)],
        }],
        [],
    );
    assert.deepEqual(findings.map((finding) => finding.kind), ["WALLET_BALANCE_DRIFT", "BALANCE_AFTER_DRIFT"]);
});

test("detects double debits and debits on unsettled purchases", () => {
    const { findings } = verifyLedger([], [
        purchase("double", "COMPLETED", 2),
        purchase("missing", "COMPLETED", 0),
        purchase("open", "PENDING", 1),
    ]);
    assert.deepEqual(findings.map((finding) => finding.kind), [
        "COMPLETED_PURCHASE_WITHOUT_ONE_CONSUMPTION",
        "COMPLETED_PURCHASE_WITHOUT_ONE_CONSUMPTION",
        "UNSETTLED_PURCHASE_WITH_CONSUMPTION",
    ]);
});

test("a completed purchase reclassified out of the active ledger is reported, not alerted", () => {
    const { findings, exclusions } = verifyLedger([], [purchase("reclassified", "COMPLETED", 0, 1)]);
    assert.deepEqual(findings, []);
    assert.deepEqual(exclusions, [{ purchaseId: "reclassified", failedConsumptions: 1 }]);
});
