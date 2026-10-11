import assert from "node:assert/strict";
import test from "node:test";

import { rebuildBalances } from "../src/lib/wallet/ledger.ts";
import {
    bogotaLocalNow,
    bogotaLocalToIso,
    effectiveTimeLabel,
    effectiveTimeProblem,
    formatLedgerDate,
    formatLedgerDateTime,
    normalizeBankReference,
} from "../src/lib/wallet/effective-time.ts";
import { manualRechargeFingerprint } from "../src/lib/wallet/recharge-request.ts";

test("a Colombian wall-clock time becomes an ISO instant with -05:00", () => {
    const iso = bogotaLocalToIso("2026-10-11T09:30");
    assert.equal(iso, "2026-10-11T09:30:00-05:00");
    assert.equal(new Date(iso).toISOString(), "2026-10-11T14:30:00.000Z");
});

test("impossible or malformed wall-clock times are rejected, not rolled over", () => {
    assert.throws(() => bogotaLocalToIso("2026-02-31T10:00"));
    assert.throws(() => bogotaLocalToIso("2026-10-11 09:30"));
    assert.throws(() => bogotaLocalToIso(""));
});

test("bogotaLocalNow is the datetime-local value of an instant in Colombia", () => {
    assert.equal(bogotaLocalNow(new Date("2026-10-11T03:15:00Z")), "2026-10-10T22:15");
});

test("ledger times are shown in Colombia whatever the process time zone", () => {
    // 02:30 UTC on Oct 11 is still 21:30 on Oct 10 in Bogotá. Run with any TZ.
    const plain = (text) => text.replace(/\s/g, " ");
    const instant = "2026-10-11T02:30:00.000Z";
    assert.equal(plain(formatLedgerDateTime(instant)), "10 de oct de 2026, 09:30 p. m.");
    assert.equal(plain(formatLedgerDate(instant)), "10 de oct de 2026");
});

test("the effective time cannot be in the future beyond clock skew", () => {
    const now = new Date("2026-10-11T15:00:00Z");
    assert.equal(effectiveTimeProblem({ occurredAt: new Date("2026-10-11T14:00:00Z"), now }), null);
    assert.equal(effectiveTimeProblem({ occurredAt: new Date("2026-10-11T15:04:00Z"), now }), null);
    assert.match(effectiveTimeProblem({ occurredAt: new Date("2026-10-11T16:00:00Z"), now }), /futuro/);
    // A payment may precede the (lazily created) wallet row.
    assert.equal(effectiveTimeProblem({ occurredAt: new Date("2026-01-01T00:00:00Z"), now }), null);
    assert.match(effectiveTimeProblem({ occurredAt: new Date("invalid"), now }), /inválida/);
});

test("a historical top-up without payment time says so and shows its registration", () => {
    const label = effectiveTimeLabel("REGISTRATION_ONLY", "2026-08-02T20:20:03.494Z");
    assert.match(label, /^Sin hora de pago · registrado el /);
    assert.equal(effectiveTimeLabel("LEDGER_EVENT", "2026-08-02T20:20:03.494Z"), null);
    assert.equal(effectiveTimeLabel("PAYMENT", "2026-08-02T20:20:03.494Z"), "Hora del pago");
    assert.equal(effectiveTimeLabel("GATEWAY_CONFIRMATION", "2026-08-02T20:20:03.494Z"), "Pago confirmado por Diem");
});

test("bank references and request fingerprints ignore case and spacing only", () => {
    assert.equal(normalizeBankReference("  trf  123 ab "), "TRF 123 AB");
    const base = {
        companyId: "c1",
        amount: 150000,
        occurredAt: new Date("2026-10-11T09:30:00-05:00"),
        externalReference: "trf 123",
    };
    const same = manualRechargeFingerprint(base);
    assert.equal(manualRechargeFingerprint({ ...base, externalReference: " TRF   123 " }), same);
    assert.equal(manualRechargeFingerprint({ ...base, occurredAt: new Date("2026-10-11T14:30:00Z") }), same);
    assert.notEqual(manualRechargeFingerprint({ ...base, amount: 150001 }), same);
    assert.notEqual(manualRechargeFingerprint({ ...base, occurredAt: new Date("2026-10-11T09:31:00-05:00") }), same);
    assert.notEqual(manualRechargeFingerprint({ ...base, companyId: "c2" }), same);
});

test("a top-up dated before existing movements reorders the running balances", () => {
    const at = (hour) => new Date(Date.UTC(2026, 9, 11, hour));
    const rows = [
        { id: "c1", type: "CONSUMPTION", status: "CONFIRMED", amount: 100, occurredAt: at(10), occurredSequence: 0 },
        { id: "c2", type: "CONSUMPTION", status: "CONFIRMED", amount: 50, occurredAt: at(12), occurredSequence: 0 },
        // Registered last, paid between both consumptions.
        { id: "r1", type: "RECHARGE", status: "CONFIRMED", amount: 300, occurredAt: at(11), occurredSequence: 0 },
    ];
    const { balances, balance } = rebuildBalances(rows);
    assert.equal(balances.get("c1"), -100);
    assert.equal(balances.get("r1"), 200);
    assert.equal(balances.get("c2"), 150);
    assert.equal(balance, 150);
});
