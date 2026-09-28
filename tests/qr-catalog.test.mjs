import assert from "node:assert/strict";
import test from "node:test";

import {
    RETIRED_STEAM_SKUS,
    STEAM_COP_CATALOG,
} from "../src/lib/catalog/steam.ts";
import {
    isValidQrQuantity,
    resolveQrSelection,
    toQrCatalogItems,
} from "../src/lib/qr/catalog.ts";

function productFromSpec(spec, overrides = {}) {
    return {
        id: `product-${spec.sku}`,
        name: spec.name,
        sku: spec.sku,
        isActive: true,
        isGiftCard: true,
        devDiemProductId: null,
        denominations: [{
            id: `denomination-${spec.sku}`,
            amount: spec.amount,
            currency: spec.currency,
            devDiemProductId: spec.devDiemProductId,
        }],
        ...overrides,
    };
}

test("QR catalog exposes every canonical Steam COP denomination once", () => {
    const products = STEAM_COP_CATALOG.map((spec) => productFromSpec(spec));
    const items = toQrCatalogItems(products);

    assert.deepEqual(
        items.map((item) => item.amount).sort((left, right) => left - right),
        [20500, 41000, 82000, 123000, 205000],
    );
    assert.equal(new Set(items.map((item) => item.denominationId)).size, 5);
});

test("QR catalog excludes retired, inactive and unmapped products", () => {
    const base = STEAM_COP_CATALOG[0];
    const retired = productFromSpec(base, {
        id: "retired",
        sku: RETIRED_STEAM_SKUS[0],
    });
    const inactive = productFromSpec(base, { id: "inactive", isActive: false });
    const unmapped = productFromSpec(base, {
        id: "unmapped",
        denominations: [{
            id: "unmapped-denomination",
            amount: base.amount,
            currency: base.currency,
            devDiemProductId: null,
        }],
    });

    assert.deepEqual(toQrCatalogItems([retired, inactive, unmapped]), []);
});

test("QR selection binds the product to its mapped denomination", () => {
    const product = productFromSpec(STEAM_COP_CATALOG[0]);
    const result = resolveQrSelection({
        product,
        denominationId: product.denominations[0].id,
    });

    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.denomination.amount, 20500);
});

test("QR creation requires denominationId and rejects every custom amount", () => {
    const product = productFromSpec(STEAM_COP_CATALOG[0]);

    assert.deepEqual(
        resolveQrSelection({ product }),
        { ok: false, code: "QR_DENOMINATION_INVALID" },
    );
    assert.deepEqual(
        resolveQrSelection({
            product,
            denominationId: product.denominations[0].id,
            customAmount: 20500,
        }),
        { ok: false, code: "QR_CUSTOM_AMOUNT_NOT_ALLOWED" },
    );
    assert.deepEqual(
        resolveQrSelection({
            product,
            denominationId: product.denominations[0].id,
            customAmount: null,
        }),
        { ok: false, code: "QR_CUSTOM_AMOUNT_NOT_ALLOWED" },
    );
});

test("QR selection rejects a denomination from another product", () => {
    const product = productFromSpec(STEAM_COP_CATALOG[0]);
    assert.deepEqual(
        resolveQrSelection({ product, denominationId: "another-product-denomination" }),
        { ok: false, code: "QR_DENOMINATION_INVALID" },
    );
});

test("QR quantity is an integer from 1 through 100", () => {
    assert.equal(isValidQrQuantity(1), true);
    assert.equal(isValidQrQuantity(100), true);
    assert.equal(isValidQrQuantity(0), false);
    assert.equal(isValidQrQuantity(101), false);
    assert.equal(isValidQrQuantity(1.5), false);
    assert.equal(isValidQrQuantity("1"), false);
});
