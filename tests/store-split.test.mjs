import test from "node:test";
import assert from "node:assert/strict";
import { planStoreMerge, planStoreSplit } from "../src/lib/wallet/store-split.ts";

const row = (id, type, amount, occurredAt, extra = {}) => ({
    id,
    type,
    amount,
    status: "CONFIRMED",
    occurredAt: new Date(occurredAt),
    occurredSequence: 0,
    balanceAfter: null,
    codePurchaseId: null,
    cardActivationId: null,
    reversalOfId: null,
    inStatement: false,
    ...extra,
});

const labRows = () => [
    row("lab-1", "CONSUMPTION", 1_000_000, "2026-10-01T10:00:00-05:00", { codePurchaseId: "p-lab" }),
    row("192-1", "CONSUMPTION", 324_000, "2026-10-10T21:27:44-05:00", { codePurchaseId: "p-192-a" }),
    row("192-2", "CONSUMPTION", 180_000, "2026-10-10T21:30:29-05:00", { codePurchaseId: "p-192-b" }),
    row("lab-2", "CONSUMPTION", 500_000, "2026-10-20T10:00:00-05:00", { codePurchaseId: "p-lab-2" }),
    row("act-1", "CONSUMPTION", 60_000, "2026-10-21T10:00:00-05:00", { cardActivationId: "a-192" }),
];

test("the store's purchases and activations leave the source wallet without compensation", () => {
    const plan = planStoreSplit({
        purchases: [{ id: "p-192-a", status: "COMPLETED" }, { id: "p-192-b", status: "COMPLETED" }],
        activationIds: ["a-192"],
        sourceRows: labRows(),
        sourceBalance: -2_064_000,
    });
    assert.deepEqual(plan.movementIds, ["192-1", "192-2", "act-1"]);
    assert.equal(plan.movedAmount.consumptions, 564_000);
    assert.equal(plan.source.balanceBefore, -2_064_000);
    assert.equal(plan.source.balanceAfter, -1_500_000);
    assert.equal(plan.target.balanceAfter, -564_000);
});

test("a reversal travels with the consumption it reverses", () => {
    const rows = [
        ...labRows(),
        row("refund-192", "REFUND", 180_000, "2026-10-11T09:00:00-05:00", { reversalOfId: "192-2" }),
    ];
    const plan = planStoreSplit({
        purchases: [{ id: "p-192-b", status: "REVERSED" }],
        activationIds: [],
        sourceRows: rows,
        sourceBalance: -1_884_000,
    });
    assert.deepEqual(plan.movementIds, ["192-2", "refund-192"]);
    assert.equal(plan.target.balanceAfter, 0);
    assert.equal(plan.source.balanceAfter, -1_884_000);
});

test("purchases still in flight block the split", () => {
    assert.throws(() => planStoreSplit({
        purchases: [{ id: "p-192-a", status: "AWAITING_STOCK" }],
        activationIds: [],
        sourceRows: labRows(),
        sourceBalance: -2_064_000,
    }), /sin cerrar/);
});

test("movements already reported in an account statement are not moved", () => {
    const rows = labRows().map((r) => r.id === "192-1" ? { ...r, inStatement: true } : r);
    assert.throws(() => planStoreSplit({
        purchases: [{ id: "p-192-a", status: "COMPLETED" }],
        activationIds: [],
        sourceRows: rows,
        sourceBalance: -2_064_000,
    }), /estado de cuenta/);
});

test("movements before the source's active opening are rejected", () => {
    const rows = [
        ...labRows(),
        row("opening", "OPENING_BALANCE", 800_000, "2026-10-15T00:00:00-05:00"),
    ];
    assert.throws(() => planStoreSplit({
        purchases: [{ id: "p-192-a", status: "COMPLETED" }],
        activationIds: [],
        sourceRows: rows,
        sourceBalance: -1_360_000,
    }), /saldo inicial vigente/);
});

test("a source wallet with drift must be reconciled first", () => {
    assert.throws(() => planStoreSplit({
        purchases: [{ id: "p-192-a", status: "COMPLETED" }],
        activationIds: [],
        sourceRows: labRows(),
        sourceBalance: -1,
    }), /drift/);
});

test("a split store can rejoin an existing wallet without compensation", () => {
    const sourceRows = [
        row("192-1", "CONSUMPTION", 324_000, "2026-10-10T21:27:44-05:00", { codePurchaseId: "p-192-a" }),
        row("192-2", "CONSUMPTION", 180_000, "2026-10-10T21:30:29-05:00", { codePurchaseId: "p-192-b" }),
    ];
    const targetRows = [
        row("lab-1", "CONSUMPTION", 1_000_000, "2026-10-01T10:00:00-05:00", { codePurchaseId: "p-lab" }),
        row("lab-2", "CONSUMPTION", 500_000, "2026-10-20T10:00:00-05:00", { codePurchaseId: "p-lab-2" }),
    ];
    const plan = planStoreMerge({
        purchases: [{ id: "p-192-a", status: "COMPLETED" }, { id: "p-192-b", status: "COMPLETED" }],
        activationIds: [],
        sourceRows,
        sourceBalance: -504_000,
        targetRows,
        targetBalance: -1_500_000,
    });
    assert.deepEqual(plan.movementIds, ["192-1", "192-2"]);
    assert.equal(plan.source.balanceAfter, 0);
    assert.equal(plan.target.balanceBefore, -1_500_000);
    assert.equal(plan.target.balanceAfter, -2_004_000);
});

test("a merge cannot insert movements into the target's closed period", () => {
    assert.throws(() => planStoreMerge({
        purchases: [{ id: "p-192-a", status: "COMPLETED" }],
        activationIds: [],
        sourceRows: [row("192-1", "CONSUMPTION", 324_000, "2026-10-10T21:27:44-05:00", { codePurchaseId: "p-192-a" })],
        sourceBalance: -324_000,
        targetRows: labRows(),
        targetBalance: -2_064_000,
        targetClosedThrough: new Date("2026-10-15T23:59:59-05:00"),
    }), /periodo ya cerrado/);
});

test("a merge refuses target wallet drift", () => {
    assert.throws(() => planStoreMerge({
        purchases: [{ id: "p-192-a", status: "COMPLETED" }],
        activationIds: [],
        sourceRows: [row("192-1", "CONSUMPTION", 324_000, "2026-10-10T21:27:44-05:00", { codePurchaseId: "p-192-a" })],
        sourceBalance: -324_000,
        targetRows: labRows(),
        targetBalance: -1,
    }), /wallet destino tiene drift/);
});

test("a merge cannot hide movements behind the target's active opening balance", () => {
    const targetRows = [
        row("opening", "OPENING_BALANCE", 800_000, "2026-10-15T00:00:00-05:00"),
        row("lab-2", "CONSUMPTION", 500_000, "2026-10-20T10:00:00-05:00", { codePurchaseId: "p-lab-2" }),
    ];
    assert.throws(() => planStoreMerge({
        purchases: [{ id: "p-192-a", status: "COMPLETED" }],
        activationIds: [],
        sourceRows: [row("192-1", "CONSUMPTION", 324_000, "2026-10-10T21:27:44-05:00", { codePurchaseId: "p-192-a" })],
        sourceBalance: -324_000,
        targetRows,
        targetBalance: -1_300_000,
    }), /saldo inicial vigente de la wallet destino/);
});
