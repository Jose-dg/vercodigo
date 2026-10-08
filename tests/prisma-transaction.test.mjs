import assert from 'node:assert/strict';
import test from 'node:test';

import { runSerializableTransaction } from '../src/lib/prisma-transaction.ts';

test('serializable ORM transactions retry only accepted concurrency conflicts', async () => {
    const conflict = new Error('serialization conflict');
    let attempts = 0;
    const host = {
        async $transaction(work, options) {
            attempts += 1;
            assert.equal(options.isolationLevel, 'Serializable');
            if (attempts < 3) throw conflict;
            return work({ marker: 'orm-transaction' });
        },
    };

    const result = await runSerializableTransaction(
        host,
        async (tx) => tx.marker,
        { baseDelayMs: 0, retryOn: (error) => error === conflict },
    );

    assert.equal(result, 'orm-transaction');
    assert.equal(attempts, 3);
});

test('serializable ORM transactions do not retry unrelated failures', async () => {
    const failure = new Error('business validation failed');
    let attempts = 0;
    const host = {
        async $transaction() {
            attempts += 1;
            throw failure;
        },
    };

    await assert.rejects(
        () => runSerializableTransaction(host, async () => undefined, { baseDelayMs: 0 }),
        failure,
    );
    assert.equal(attempts, 1);
});
