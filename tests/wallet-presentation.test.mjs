import assert from "node:assert/strict";
import test from "node:test";

import {
    formatWalletRunningBalance,
    walletMovementDescription,
    walletPurchaseDescription,
    walletPurchaseOriginDescription,
} from "../src/lib/wallet/presentation.ts";

test("historical Blue Panther purchases use the customer-facing Buy label", () => {
    assert.equal(walletMovementDescription({
        description: "1 unidad facturada · 2 códigos registrados",
        externalReference: null,
        historicalAction: "Buy",
        historicalBuyerName: "Blue Panther",
    }), "Buy - Blue Panther");
});

test("historical Blue Panther recharges use the customer-facing Payment label", () => {
    assert.equal(walletMovementDescription({
        description: "Abono manual histórico Blue Panther",
        externalReference: "M26048665",
        historicalAction: "Payment",
        historicalBuyerName: "Blue Panther",
    }), "Payment - Blue Panther");
});

test("non-historical movement descriptions remain unchanged", () => {
    assert.equal(walletMovementDescription({
        description: "Abono confirmado",
        externalReference: "M26048665",
    }), "Abono confirmado");
});

test("purchase descriptions use the canonical wallet nomenclature", () => {
    assert.equal(
        walletPurchaseDescription(1, "PlayStation Gift Card US$10 — USA"),
        "Compra de 1 código(s) PlayStation Gift Card US$10 — USA",
    );
    assert.equal(
        walletPurchaseDescription(3, "PlayStation Gift Card US$10 — USA"),
        "Compra de 3 código(s) PlayStation Gift Card US$10 — USA",
    );
});

test("purchase origins prefer phone, otherwise store, and omit missing origins", () => {
    assert.equal(walletPurchaseOriginDescription({
        phone: "3003702892",
        label: "Edwin",
        storeName: "Sede ignorada",
    }), "Número: 3003702892 · Edwin");
    assert.equal(walletPurchaseOriginDescription({
        label: "Sede Centro",
        storeName: "Nombre actual",
    }), "Sede: Sede Centro");
    assert.equal(walletPurchaseOriginDescription({ storeName: "Sede Norte" }), "Sede: Sede Norte");
    assert.equal(walletPurchaseOriginDescription({ label: "Virtual Zone" }), "Sede: Virtual Zone");
    assert.equal(walletPurchaseOriginDescription({}), null);
});

test("running balances show absolute COP amounts without status suffixes", () => {
    assert.equal(formatWalletRunningBalance(-924_000, "COP"), "$\u00a0924.000 COP");
    assert.equal(formatWalletRunningBalance(200_000, "COP"), "$\u00a0200.000 COP");
    assert.equal(formatWalletRunningBalance(0, "COP"), "$\u00a00 COP");
});
