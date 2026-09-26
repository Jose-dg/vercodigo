import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
    isFulfillmentWaitLocal,
    isSettledFulfillmentStatus,
} from '../src/services/self-service/fulfillment-lifecycle.ts';

test('settlement is only COMPLETED or FAILED', () => {
    assert.equal(isSettledFulfillmentStatus('COMPLETED'), true);
    assert.equal(isSettledFulfillmentStatus('FAILED'), true);
    assert.equal(isSettledFulfillmentStatus('ACTION_REQUIRED'), false);
    assert.equal(isSettledFulfillmentStatus('PENDING'), false);
    assert.equal(isSettledFulfillmentStatus('AWAITING_STOCK'), false);
});

test('local wait stops UI polling but still lets the webhook resume', () => {
    assert.equal(isFulfillmentWaitLocal('ACTION_REQUIRED'), true);
    assert.equal(isFulfillmentWaitLocal('COMPLETED'), true);
    assert.equal(isFulfillmentWaitLocal('FAILED'), true);
    assert.equal(isFulfillmentWaitLocal('PENDING'), false);
    assert.equal(isFulfillmentWaitLocal('AWAITING_STOCK'), false);
});
