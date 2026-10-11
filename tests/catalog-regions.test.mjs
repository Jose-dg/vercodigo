import assert from 'node:assert/strict';
import test from 'node:test';

import {
    brandAccent,
    filterProductsByRegion,
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
