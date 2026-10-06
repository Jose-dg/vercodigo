import test from "node:test";
import assert from "node:assert/strict";
import { rebuildBalances } from "../src/lib/wallet/ledger.ts";

test("an opening balance resets earlier history without creating an adjustment", () => {
    const row = (id, type, amount, occurredAt, occurredSequence = 0) => ({ id, type, amount, occurredAt: new Date(occurredAt), occurredSequence, status: "CONFIRMED" });
    const result = rebuildBalances([
        row("old", "CONSUMPTION", 4_000_000, "2026-09-20T12:00:00-05:00"),
        row("opening", "OPENING_BALANCE", 1_679_200, "2026-09-29T13:39:00-05:00"),
        row("payment", "RECHARGE", 1_400_000, "2026-09-30T16:29:00-05:00"),
        row("buy", "CONSUMPTION", 1_361_250, "2026-10-06T13:05:13.739-05:00"),
    ]);
    assert.equal(result.balances.has("old"), false);
    assert.equal(result.balances.get("opening"), -1_679_200);
    assert.equal(result.balances.get("payment"), -279_200);
    assert.equal(result.balance, -1_640_450);
});

test("only the latest confirmed opening is part of the active ledger", () => {
    const row = (id, type, amount, occurredAt, occurredSequence = 0) => ({ id, type, amount, occurredAt: new Date(occurredAt), occurredSequence, status: "CONFIRMED" });
    const result = rebuildBalances([
        row("opening-old", "OPENING_BALANCE", 900_000, "2026-08-01T10:00:00-05:00"),
        row("buy-old", "CONSUMPTION", 100_000, "2026-08-02T10:00:00-05:00"),
        row("opening-current", "OPENING_BALANCE", 1_679_200, "2026-09-29T13:39:00-05:00"),
        row("payment", "RECHARGE", 1_400_000, "2026-09-30T16:29:00-05:00"),
    ]);
    assert.deepEqual([...result.balances.keys()], ["opening-current", "payment"]);
    assert.equal(result.balance, -279_200);
});

test("effective-time ties use the explicit stable sequence before the id", () => {
    const occurredAt = new Date("2026-10-02T13:51:00-05:00");
    const result = rebuildBalances([
        { id: "z", type: "OPENING_BALANCE", amount: 100, occurredAt, occurredSequence: 1, status: "CONFIRMED" },
        { id: "a", type: "RECHARGE", amount: 40, occurredAt, occurredSequence: 2, status: "CONFIRMED" },
    ]);
    assert.deepEqual([...result.balances.keys()], ["z", "a"]);
    assert.equal(result.balance, -60);
});

test("Virtual Zone reconstructs all 14 events and intermediate debt balances", () => {
    const confirmed = (id, type, amount, occurredAt, occurredSequence = 0) => ({
        id, type, amount, occurredAt: new Date(occurredAt), occurredSequence, status: "CONFIRMED",
    });
    const rows = [
        confirmed("opening", "OPENING_BALANCE", 1_679_200, "2026-09-29T13:39:00-05:00"),
        confirmed("payment", "RECHARGE", 1_400_000, "2026-09-30T16:29:00-05:00"),
        confirmed("p01", "CONSUMPTION", 66_000, "2026-10-01T18:13:00-05:00", 1),
        confirmed("p02", "CONSUMPTION", 163_500, "2026-10-02T13:51:00-05:00", 2),
        confirmed("p03", "CONSUMPTION", 32_700, "2026-10-02T13:51:00-05:00", 3),
        confirmed("p04", "CONSUMPTION", 81_750, "2026-10-02T14:59:00-05:00", 4),
        confirmed("p05", "CONSUMPTION", 163_500, "2026-10-02T19:34:00-05:00", 5),
        confirmed("p06", "CONSUMPTION", 32_700, "2026-10-02T19:37:00-05:00", 6),
        confirmed("p07", "CONSUMPTION", 98_550, "2026-10-03T09:30:00-05:00", 7),
        confirmed("p08", "CONSUMPTION", 32_850, "2026-10-03T12:22:00-05:00", 8),
        confirmed("p09", "CONSUMPTION", 252_750, "2026-10-05T04:43:00-05:00", 9),
        confirmed("p10", "CONSUMPTION", 84_250, "2026-10-05T04:45:00-05:00", 10),
        confirmed("p11", "CONSUMPTION", 33_700, "2026-10-05T04:48:00-05:00", 11),
        confirmed("p12", "CONSUMPTION", 319_000, "2026-10-06T13:05:13.739-05:00", 12),
    ];
    const result = rebuildBalances(rows);
    assert.deepEqual([...result.balances.values()], [
        -1_679_200, -279_200, -345_200, -508_700, -541_400, -623_150,
        -786_650, -819_350, -917_900, -950_750, -1_203_500, -1_287_750,
        -1_321_450, -1_640_450,
    ]);
    assert.equal(result.balance, -1_640_450);
});
