import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';

import {
    checkDiemConnection,
    createCodeRequest,
    getCodeRequest,
    getDiemConfig,
    revealCodeRequest,
} from '../src/lib/devdiem/fulfillment.ts';

const ORIGINAL_ENV = {
    DIEM_API_URL: process.env.DIEM_API_URL,
    DIEM_SERVICE_API_KEY: process.env.DIEM_SERVICE_API_KEY,
    DIEM_STORE_ID: process.env.DIEM_STORE_ID,
};
const ORIGINAL_FETCH = globalThis.fetch;
const STORE_ID = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
    process.env.DIEM_API_URL = 'https://diem.example.test/';
    process.env.DIEM_SERVICE_API_KEY = 'ddk_test_secret';
    process.env.DIEM_STORE_ID = STORE_ID;
});

afterEach(() => {
    for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }
    globalThis.fetch = ORIGINAL_FETCH;
});

test('configuration fails closed instead of defaulting to production', () => {
    delete process.env.DIEM_API_URL;
    assert.throws(() => getDiemConfig(), /DIEM_API_URL no está configurada/);

    process.env.DIEM_API_URL = 'http://diem.example.test';
    assert.throws(() => getDiemConfig(), /debe usar HTTPS/);

    process.env.DIEM_API_URL = 'http://127.0.0.1:8000';
    assert.equal(getDiemConfig().baseUrl, 'http://127.0.0.1:8000');
});

test('createCodeRequest sends the Diem-SAS partner contract and idempotency header', async () => {
    let captured;
    globalThis.fetch = async (url, init) => {
        captured = { url: String(url), init };
        return Response.json(
            { id: 'request-1', status: 'received', external_reference: 'purchase-1' },
            { status: 202 },
        );
    };

    const result = await createCodeRequest({
        idempotencyKey: 'purchase-key-1',
        externalReference: 'purchase-1',
        source: 'partner_api',
        productId: '22222222-2222-4222-8222-222222222222',
        quantity: 2,
        recipient: {
            firstName: 'Ada',
            lastName: 'Lovelace',
            email: 'ada@example.com',
        },
    });

    assert.equal(result.id, 'request-1');
    assert.equal(captured.url, 'https://diem.example.test/api/v1/code-requests/');
    assert.equal(captured.init.headers.Authorization, 'Bearer ddk_test_secret');
    assert.equal(captured.init.headers['Idempotency-Key'], 'purchase-key-1');
    const body = JSON.parse(captured.init.body);
    assert.equal(body.store_id, STORE_ID);
    assert.equal(body.delivery_mode, 'partner_retrieval');
    assert.equal(body.items[0].quantity, 2);
    assert.equal(body.metadata.application, 'diem-sas');
});

test('status and reveal use protected endpoints and flatten delivered codes', async () => {
    const calls = [];
    globalThis.fetch = async (url, init = {}) => {
        calls.push({ url: String(url), init });
        if (String(url).endsWith('/reveal/')) {
            return Response.json({
                items: [{ codes: ['CODE-A'] }, { codes: ['CODE-B', 'CODE-C'] }],
            });
        }
        return Response.json({
            id: 'request/with spaces',
            status: 'allocated',
            external_reference: 'purchase-1',
        });
    };

    await getCodeRequest('request/with spaces');
    const codes = await revealCodeRequest('request/with spaces', 'purchase:1');

    assert.match(calls[0].url, /request%2Fwith%20spaces\/$/);
    assert.match(calls[1].url, /request%2Fwith%20spaces\/reveal\/$/);
    assert.equal(calls[1].init.headers['X-Correlation-ID'], 'purchase:1');
    assert.deepEqual(codes, ['CODE-A', 'CODE-B', 'CODE-C']);
});

test('Diem HTTP errors preserve status and provider detail', async () => {
    globalThis.fetch = async () => Response.json(
        { detail: 'Service account lacks code_requests:create scope.' },
        { status: 403 },
    );

    await assert.rejects(
        () => getCodeRequest('request-1'),
        (error) => {
            assert.equal(error.status, 403);
            assert.match(error.message, /lacks code_requests:create/);
            return true;
        },
    );
});

test('connection check validates credentials, store grant and catalog access', async () => {
    let calls = 0;
    globalThis.fetch = async (url, init) => {
        calls += 1;
        assert.match(String(url), /catalog\/products\/\?/);
        assert.equal(init.headers.Authorization, 'Bearer ddk_test_secret');
        if (calls === 1) {
            assert.match(String(url), new RegExp(`store_id=${STORE_ID}`));
            assert.match(String(url), /page_size=100/);
            return Response.json({
                next: `https://diem.example.test/api/v1/catalog/products/?page=2&store_id=${STORE_ID}`,
                results: [{ product_id: 'one' }],
            });
        }
        return Response.json({ next: null, results: [{ product_id: 'two' }] });
    };

    assert.deepEqual(await checkDiemConnection(), {
        ok: true,
        storeId: STORE_ID,
        catalogProducts: 2,
        catalogProductIds: ['one', 'two'],
    });
});
