import assert from 'node:assert/strict';
import test from 'node:test';

import {
    filterProductsByRegion,
    productRegions,
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
