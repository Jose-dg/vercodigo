import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const SOURCE_URL = new URL('../src/services/pricing/sale-repricing.service.ts', import.meta.url);

test('sale repricing uses Prisma ORM without handwritten SQL', async () => {
    const source = await readFile(SOURCE_URL, 'utf8');

    assert.doesNotMatch(source, /\$(?:queryRaw|queryRawUnsafe|executeRaw|executeRawUnsafe)/);
    assert.match(source, /runSerializableTransaction\(prisma/);
});

test('sale repricing keeps the Diem call outside the local serializable transaction', async () => {
    const source = await readFile(SOURCE_URL, 'utf8');
    const remoteCall = source.indexOf('await correctCodeRequestCommercialPrice');
    const localTransaction = source.indexOf('return runSerializable');

    assert.notEqual(remoteCall, -1);
    assert.notEqual(localTransaction, -1);
    assert.ok(remoteCall < localTransaction);
});
