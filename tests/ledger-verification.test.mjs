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

test("a purchase cancelled after delivery nets to zero with exactly one refund", () => {
    const wallet = {
        id: "w1",
        companyId: "c1",
        balance: -1000,
        rows: [
            row("o", "OPENING_BALANCE", 1000, -1000, 0),
            row("c", "CONSUMPTION", 100, -1100, 1),
            row("r", "REFUND", 100, -1000, 2),
        ],
    };
    const reversed = { ...purchase("p1", "REVERSED", 1), reversals: 1 };
    assert.deepEqual(verifyLedger([wallet], [reversed]).findings, []);
});

test("flags a reversed purchase that was not refunded, or a completed one that was", () => {
    const { findings } = verifyLedger([], [
        { ...purchase("p1", "REVERSED", 1), reversals: 0 },
        { ...purchase("p2", "REVERSED", 1), reversals: 2 },
        { ...purchase("p3", "COMPLETED", 1), reversals: 1 },
    ]);
    assert.deepEqual(findings.map((finding) => [finding.kind, finding.purchaseId]), [
        ["REVERSED_PURCHASE_NOT_REFUNDED_ONCE", "p1"],
        ["REVERSED_PURCHASE_NOT_REFUNDED_ONCE", "p2"],
        ["COMPLETED_PURCHASE_REFUNDED", "p3"],
    ]);
});

test("a movement dated inside an issued period but outside every statement is reported", () => {
    const wallet = (rows) => ({
        id: "w1",
        companyId: "c1",
        balance: rows.reduce((balance, current) => current.balanceAfter ?? balance, 0),
        statementCoverage: { from: at(0), until: at(30) },
        rows,
    });
    const recharge = (id, minute, inStatement) => ({
        ...row(id, "RECHARGE", 100, 100, minute),
        inStatement,
    });

    const clean = verifyLedger([wallet([{ ...recharge("anchor", 0, false), balanceAfter: 100 }])], []);
    assert.deepEqual(clean.findings, [], "the first statement's opening anchor is excluded on purpose");

    const reported = verifyLedger([wallet([recharge("in", 10, true)])], []);
    assert.deepEqual(reported.findings, []);

    const after = verifyLedger([wallet([recharge("next", 40, false)])], []);
    assert.deepEqual(after.findings, [], "movements after the last cut belong to the next statement");

    const hidden = verifyLedger([wallet([recharge("late", 20, false)])], []);
    assert.deepEqual(hidden.findings.map((finding) => finding.kind), ["MOVEMENT_IN_CLOSED_PERIOD"]);
});
