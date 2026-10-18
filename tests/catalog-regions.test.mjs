import assert from 'node:assert/strict';
import test from 'node:test';

import {
    brandAccent,
    distinctiveProductLabels,
    filterProductsByRegion,
    filterProductsByRegionAndBrand,
    maxPurchasableQuantity,
    productRegions,
    productStock,
    stockLabel,
} from '../src/lib/codes/catalog-regions.ts';

function product(overrides = {}) {
    return {
        id: 'product-1',
        name: 'PlayStation USD Colombia',
        brand: 'PlayStation',
        isActive: true,
        devDiemProductId: null,
        denominations: [],
        ...overrides,
    };
}

test('uses Diem country_region instead of currency or product name', () => {
    const colombiaUsd = product({
        countryRegion: 'colombia',
        denominations: [{
            id: 'co-usd',
            amount: 10,
            currency: 'USD',
            devDiemProductId: 'remote-co',
            countryRegion: 'colombia',
        }],
    });

    assert.deepEqual(productRegions(colombiaUsd), ['CO']);
    assert.equal(filterProductsByRegion([colombiaUsd], 'CO').length, 1);
    assert.equal(filterProductsByRegion([colombiaUsd], 'US').length, 0);
});

test('splits denominations by their authoritative Diem region', () => {
    const mixed = product({
        name: 'Grouped catalog product',
        denominations: [
            {
                id: 'co',
                amount: 50000,
                currency: 'COP',
                devDiemProductId: 'remote-co',
                countryRegion: 'colombia',
            },
            {
                id: 'us',
                amount: 10,
                currency: 'USD',
                devDiemProductId: 'remote-us',
                countryRegion: 'united_states',
            },
        ],
    });

    assert.deepEqual(productRegions(mixed).sort(), ['CO', 'US']);
    assert.deepEqual(
        filterProductsByRegion([mixed], 'CO')[0].denominations.map((row) => row.id),
        ['co'],
    );
    assert.deepEqual(
        filterProductsByRegion([mixed], 'US')[0].denominations.map((row) => row.id),
        ['us'],
    );
});

test('fails closed when Diem does not provide a supported region', () => {
    const unknown = product({
        denominations: [{
            id: 'unknown',
            amount: 10,
            currency: 'USD',
            devDiemProductId: 'remote-unknown',
            countryRegion: null,
        }],
    });

    assert.deepEqual(productRegions(unknown), []);
    assert.equal(filterProductsByRegion([unknown], 'CO').length, 0);
    assert.equal(filterProductsByRegion([unknown], 'US').length, 0);
});

test('uses Mercado Libre yellow accent', () => {
    assert.equal(brandAccent('Mercado Libre').bg, 'bg-yellow-400');
    assert.equal(brandAccent('MELI').bg, 'bg-yellow-400');
});

test('uses IMVU, Google Play and Uber accents', () => {
    assert.equal(brandAccent('IMVU').bg, 'bg-violet-700');
    assert.equal(brandAccent('Google Play').bg, 'bg-green-600');
    assert.equal(brandAccent('Uber').bg, 'bg-zinc-950');
});

test('sums reported denomination stock and labels out-of-stock', () => {
    const withStock = product({
        denominations: [
            { id: 'a', amount: 24000, currency: 'COP', devDiemProductId: 'imvu-24', availableUnits: 2 },
            { id: 'b', amount: 48000, currency: 'COP', devDiemProductId: 'imvu-48', availableUnits: 0 },
        ],
    });
    assert.equal(productStock(withStock), 2);
    assert.equal(stockLabel(0), 'Sin stock');
    assert.equal(stockLabel(2), '2 disponibles');
    // Zero stock does not cap the order: Diem parks it as awaiting_stock (2cf83ba).
    assert.equal(maxPurchasableQuantity(0), 100);
    assert.equal(maxPurchasableQuantity(null), 100);
});

test("los productos de una marca se ordenan por valor, no alfabéticamente", () => {
    const product = (id, amount) => ({
        id, name: `PlayStation Gift Card US$${amount} — USA`, brand: "PlayStation", isActive: true,
        countryRegion: "united_states", denominations: [{ id: `d${id}`, amount, currency: "USD", countryRegion: "united_states" }],
    });
    const ordered = filterProductsByRegionAndBrand(
        [product("a", 100), product("b", 2), product("c", 10), product("d", 1), product("e", 25)],
        "US",
        "PlayStation",
    );
    assert.deepEqual(ordered.map((p) => p.denominations[0].amount), [1, 2, 10, 25, 100]);
});

test("las tarjetas compactas muestran solo lo que distingue a cada producto", () => {
    const labels = (names) => [...distinctiveProductLabels(names.map((name, i) => ({ id: String(i), name }))).values()];
    assert.deepEqual(labels(["PlayStation Gift Card US$1 — USA", "PlayStation Gift Card US$250 — USA"]), ["US$1", "US$250"]);
    assert.deepEqual(labels(["Xbox Game Pass Core 12 Meses", "Xbox Game Pass Ultimate 1 Mes"]), ["Core 12 Meses", "Ultimate 1 Mes"]);
    // Un sufijo común sin separador es parte del nombre: no se quita.
    assert.deepEqual(labels(["Free Fire 100 diamantes", "Free Fire 1060 diamantes"]), ["100 diamantes", "1060 diamantes"]);
    // Un solo producto conserva su nombre completo.
    assert.deepEqual(labels(["Roblox"]), ["Roblox"]);
});
