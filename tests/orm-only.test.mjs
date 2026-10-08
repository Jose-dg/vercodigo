import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const SOURCE_ROOT = fileURLToPath(new URL('../src/', import.meta.url));
const FORBIDDEN_PRISMA_RAW = /\$(?:queryRaw|queryRawUnsafe|executeRaw|executeRawUnsafe)|\bPrisma\.sql\b/;
const FORBIDDEN_DATABASE_DRIVER = /from\s+['"](?:pg|postgres|@vercel\/postgres)['"]|require\(['"](?:pg|postgres|@vercel\/postgres)['"]\)/;

async function sourceFiles(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) files.push(...await sourceFiles(path));
        else if (['.ts', '.tsx'].includes(extname(entry.name))) files.push(path);
    }
    return files;
}

test('application queries and writes use Prisma ORM instead of handwritten SQL', async () => {
    const violations = [];
    for (const path of await sourceFiles(SOURCE_ROOT)) {
        const source = await readFile(path, 'utf8');
        if (FORBIDDEN_PRISMA_RAW.test(source) || FORBIDDEN_DATABASE_DRIVER.test(source)) violations.push(path);
    }
    assert.deepEqual(violations, []);
});
