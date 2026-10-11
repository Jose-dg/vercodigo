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
});
