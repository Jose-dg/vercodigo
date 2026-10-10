import test from "node:test";
import assert from "node:assert/strict";

import {
    BUY_CODES_FAMILIES,
    COP_PER_USD,
    GOOGLE_PLAY_CATALOG,
    NINTENDO_CATALOG,
    catalogDrift,
} from "../src/lib/catalog/buy-codes.ts";

const allSpecs = Object.values(BUY_CODES_FAMILIES).flat();

function rowFromSpec(spec, overrides = {}) {
    const denominations = spec.denominations.map((item, index) => ({
        id: `${spec.sku}-${index}`,
        amount: item.amount,
        currency: item.currency,
        devDiemProductId: item.devDiemProductId,
    }));
    return {
        name: spec.name,
        brand: spec.brand,
        category: spec.category,
        isActive: true,
        isGiftCard: true,
        devDiemProductId: null,
        denominations,
        costs: spec.denominations.map((item, index) => ({
            companyId: null,
            denominationId: `${spec.sku}-${index}`,
            cost: item.cost,
            currency: "COP",
            isActive: true,
        })),
        ...overrides,
    };
}

test("cada SKU y cada producto Diem aparece una sola vez", () => {
    const skus = allSpecs.map((spec) => spec.sku);
    const remoteIds = allSpecs.flatMap((spec) => spec.denominations.map((item) => item.devDiemProductId));
    assert.equal(new Set(skus).size, skus.length);
    assert.equal(new Set(remoteIds).size, remoteIds.length);
});

test("los costos siguen la regla de plataforma: USD × 3.600 y COP al nominal", () => {
    for (const item of allSpecs.flatMap((spec) => spec.denominations)) {
        assert.equal(item.cost, item.currency === "USD" ? item.amount * COP_PER_USD : item.amount);
    }
    const nso = NINTENDO_CATALOG.filter((spec) => spec.name.startsWith("Nintendo Switch Online"));
    assert.deepEqual(nso.map((spec) => spec.denominations[0].cost), [36000, 97200]);
});

test("Google Play cubre solo los SKU limpios GPLAY-CO, no los heredados", () => {
    const amounts = GOOGLE_PLAY_CATALOG.flatMap((spec) => spec.denominations.map((item) => item.amount));
    assert.deepEqual(amounts, [10000, 30000, 50000]);
    const remoteIds = GOOGLE_PLAY_CATALOG.flatMap((spec) => spec.denominations.map((item) => item.devDiemProductId));
    assert.ok(!remoteIds.includes("bcf75061-7669-4909-8da1-cabe64c9486a"));
    assert.ok(!remoteIds.includes("bdaf2ee1-3b7a-426d-9981-6c11d3ba566c"));
});

test("catalogDrift no reporta nada cuando SAS coincide con la spec", () => {
    for (const spec of allSpecs) assert.deepEqual(catalogDrift(spec, rowFromSpec(spec)), []);
});

test("catalogDrift detecta producto faltante, inactivo, denominación y costo", () => {
    const [spec] = GOOGLE_PLAY_CATALOG;
    assert.deepEqual(catalogDrift(spec, null), ["missing"]);
    assert.ok(catalogDrift(spec, rowFromSpec(spec, { isActive: false })).includes("inactive"));

    const row = rowFromSpec(spec);
    const withoutDenomination = { ...row, denominations: row.denominations.slice(1) };
    assert.ok(catalogDrift(spec, withoutDenomination).includes("10000 COP: missing denomination"));

    const wrongCost = { ...row, costs: row.costs.map((cost, index) => (index === 0 ? { ...cost, cost: 9000 } : cost)) };
    assert.ok(catalogDrift(spec, wrongCost).includes("10000 COP: global cost"));
});
