import assert from "node:assert/strict";
import test from "node:test";

import {
    buildFinancialSnapshot,
    canIssueAccountStatement,
    canReadAccountStatement,
    hasProvisionalTaxId,
    redactSensitiveCodes,
    statementBalanceLabel,
    statementFingerprint,
} from "../src/modules/account-statements/domain.ts";

function movement(id, type, amount, balanceAfter) {
    return {
        id,
        type,
        amount,
        balanceAfter,
        occurredAt: `2026-09-${String(Number(id) + 1).padStart(2, "0")}T12:00:00.000Z`,
        description: "PlayStation Gift Card",
    };
}

test("Blue Panther closes with nine consumptions and COP 924,000 pending", () => {
    const snapshot = buildFinancialSnapshot(-198_500, [
        movement("1", "CONSUMPTION", 62_000, -260_500),
        movement("2", "CONSUMPTION", 155_000, -415_500),
        movement("3", "CONSUMPTION", 120_000, -535_500),
        movement("4", "CONSUMPTION", 63_000, -598_500),
        movement("5", "CONSUMPTION", 126_000, -724_500),
        movement("6", "CONSUMPTION", 65_000, -789_500),
        movement("7", "CONSUMPTION", 40_000, -829_500),
        movement("8", "CONSUMPTION", 62_000, -891_500),
        movement("9", "CONSUMPTION", 32_500, -924_000),
    ]);

    assert.equal(snapshot.openingBalance, "-198500.00");
    assert.equal(snapshot.lines.length, 9);
    assert.equal(snapshot.consumptions, "725500.00");
    assert.equal(snapshot.recharges, "0.00");
    assert.equal(snapshot.closingBalance, "-924000.00");
    assert.equal(snapshot.totalPending, "924000.00");
});

test("confirmed movement kinds reconcile from signed balance transitions", () => {
    const snapshot = buildFinancialSnapshot(-100, [
        movement("1", "CONSUMPTION", 50, -150),
        movement("2", "RECHARGE", 60, -90),
        movement("3", "REFUND", 20, -70),
        movement("4", "ADJUSTMENT", 10, -80),
    ]);

    assert.equal(snapshot.consumptions, "50.00");
    assert.equal(snapshot.recharges, "60.00");
    assert.equal(snapshot.refunds, "20.00");
    assert.equal(snapshot.adjustments, "-10.00");
    assert.equal(snapshot.closingBalance, "-80.00");
    assert.deepEqual(statementBalanceLabel(snapshot.closingBalance), { label: "Total pendiente", amount: "80.00" });
});

test("an opening balance anchors the statement without becoming an adjustment", () => {
    const snapshot = buildFinancialSnapshot(0, [
        movement("1", "OPENING_BALANCE", 1_679_200, -1_679_200),
        movement("2", "RECHARGE", 1_400_000, -279_200),
    ]);
    assert.equal(snapshot.adjustments, "0.00");
    assert.equal(snapshot.consumptions, "0.00");
    assert.equal(snapshot.recharges, "1400000.00");
    assert.equal(snapshot.closingBalance, "-279200.00");
});

test("fingerprint is deterministic and changes with the ledger", () => {
    const base = { companyId: "company", transactionIds: ["one", "two"], closing: "-10.00" };
    assert.equal(statementFingerprint(base), statementFingerprint(base));
    assert.notEqual(statementFingerprint(base), statementFingerprint({ ...base, closing: "-11.00" }));
});

test("provisional tax identifiers block issuance", () => {
    assert.equal(hasProvisionalTaxId("1234567"), true);
    assert.equal(hasProvisionalTaxId("111111111"), true);
    assert.equal(hasProvisionalTaxId("901.234.567-8"), false);
});

test("PIN-like values are removed before PDF rendering", () => {
    const text = redactSensitiveCodes("Entrega GA5Q-L49F-R95E y GTBEG6ALEN59 completada");
    assert.equal(text.includes("GA5Q-L49F-R95E"), false);
    assert.equal(text.includes("GTBEG6ALEN59"), false);
    assert.match(text, /código protegido/);
});

test("financial access is tenant-scoped and issuance is platform-only", () => {
    assert.equal(canIssueAccountStatement("SUPER_ADMIN"), true);
    assert.equal(canIssueAccountStatement("SYSTEM_ADMIN"), true);
    assert.equal(canIssueAccountStatement("OWNER"), false);
    assert.equal(canReadAccountStatement("OWNER", "blue-panther", "blue-panther"), true);
    assert.equal(canReadAccountStatement("GENERAL_ADMIN", "other", "blue-panther"), false);
    assert.equal(canReadAccountStatement("ADMIN", "blue-panther", "blue-panther"), false);
    assert.equal(canReadAccountStatement("OPERATOR", "blue-panther", "blue-panther"), false);
});
