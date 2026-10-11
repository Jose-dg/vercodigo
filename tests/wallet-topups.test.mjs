import assert from "node:assert/strict";
import test from "node:test";

import { balancePresentation, formatMoney } from "../src/lib/wallet/balance.ts";
import {
    BREB_MAX_PER_TRANSACTION_COP,
    openTopUpsTotal,
    shortTopUpReference,
    topUpStatePresentation,
    validateTopUpAmount,
} from "../src/lib/wallet/topups.ts";

test("negative balance reads as pending debt, positive as available credit", () => {
    assert.equal(balancePresentation(-150000).shortLabel, "Pendiente");
    assert.equal(balancePresentation(-150000).amount, 150000);
    assert.equal(balancePresentation(-150000).tone, "debt");
    assert.equal(balancePresentation(80000).shortLabel, "Disponible");
    assert.equal(balancePresentation(80000).tone, "credit");
    assert.equal(balancePresentation(0).tone, "settled");
});

test("money is formatted in Colombian pesos without decimals by default", () => {
    assert.match(formatMoney(1500000, "COP"), /1\.500\.000/);
});

test("short reference is stable and derived from the DevDiem top-up id", () => {
    const id = "3f2a9c1e-7b4d-4e2a-9f10-123456789abc";
    assert.equal(shortTopUpReference(id), "VC-3F2A9C1E");
    assert.equal(shortTopUpReference(id), shortTopUpReference(id));
});

test("amount validation enforces minimum, whole pesos and the Bre-B cap", () => {
    assert.deepEqual(validateTopUpAmount("500.000"), { ok: true, amount: 500000 });
    assert.equal(validateTopUpAmount(5000).ok, false);
    assert.equal(validateTopUpAmount(0).ok, false);
    assert.equal(validateTopUpAmount(BREB_MAX_PER_TRANSACTION_COP).ok, true);
    assert.equal(validateTopUpAmount(BREB_MAX_PER_TRANSACTION_COP + 1).ok, false);
});

test("only waiting and under-review top-ups count as in flight", () => {
    const total = openTopUpsTotal([
        { state: "created", amount: "100000.00" },
        { state: "under_review", amount: "50000.00" },
        { state: "credited", amount: "999999.00" },
        { state: "expired", amount: "1.00" },
    ]);
    assert.equal(total, 150000);
    assert.equal(topUpStatePresentation("credited").isOpen, false);
    assert.equal(topUpStatePresentation("under_review").label, "En revisión");
    // Purchases never wait for the balance: the customer is told so.
    assert.match(topUpStatePresentation("under_review").description, /seguir comprando/);
});

import {
    balanceAfterTopUp,
    debtSettlementAmount,
    timeRemaining,
    topUpInstructionsText,
    topUpTimeline,
} from "../src/lib/wallet/topups.ts";

test("balance preview splits what pays debt from what remains as credit", () => {
    assert.deepEqual(balanceAfterTopUp(-300000, 500000), { after: 200000, debtCovered: 300000, remainingDebt: 0 });
    assert.deepEqual(balanceAfterTopUp(-300000, 100000), { after: -200000, debtCovered: 100000, remainingDebt: 200000 });
    assert.deepEqual(balanceAfterTopUp(50000, 100000), { after: 150000, debtCovered: 0, remainingDebt: 0 });
});

test("debt settlement rounds up to the next thousand and respects limits", () => {
    assert.equal(debtSettlementAmount(-123456), 124000);
    assert.equal(debtSettlementAmount(-500), 10000);
    assert.equal(debtSettlementAmount(0), null);
    assert.equal(debtSettlementAmount(-20_000_000), null);
});

test("time remaining is human readable and flags urgency", () => {
    const now = new Date("2026-10-10T10:00:00Z");
    assert.equal(timeRemaining("2026-10-13T10:00:00Z", now).label, "3 d 0 h");
    assert.equal(timeRemaining("2026-10-10T11:30:00Z", now).urgent, true);
    assert.equal(timeRemaining("2026-10-10T09:00:00Z", now).expired, true);
});

test("timeline marks the current step and stops on expiry", () => {
    const review = topUpTimeline({ state: "under_review", created_at: "a", reported_at: "b" });
    assert.deepEqual(review.map((step) => step.status), ["done", "done", "current", "upcoming"]);
    const credited = topUpTimeline({ state: "credited", created_at: "a", reported_at: "b", credited_at: "c" });
    assert.ok(credited.every((step) => step.status === "done"));
    const expired = topUpTimeline({ state: "expired", created_at: "a" });
    assert.deepEqual(expired.map((step) => step.status), ["done", "stopped", "upcoming", "upcoming"]);
});

test("instructions text carries amount, reference and key", () => {
    const text = topUpInstructionsText({
        amountLabel: "$ 500.000", reference: "VC-ABC12345", key: "@sizu", expiresLabel: "13 oct 2026",
    });
    assert.match(text, /\$ 500\.000/);
    assert.match(text, /VC-ABC12345/);
    assert.match(text, /@sizu/);
});
