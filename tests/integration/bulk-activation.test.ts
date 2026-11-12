/**
 * Behavioural test for platform bulk card activation.
 *
 * Runs the real services against a disposable LOCAL PostgreSQL database and a
 * fake Diem HTTP server. It refuses to run against any non-local database.
 *
 *   TEST_DATABASE_URL=postgresql://<user>@localhost:5432/diemsas_concurrency_test \
 *     npm run test:concurrency
 */
import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, beforeEach, test } from "node:test";

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
if (!testDatabaseUrl) throw new Error("TEST_DATABASE_URL es obligatoria");
if (!["localhost", "127.0.0.1", "::1"].includes(new URL(testDatabaseUrl).hostname)) {
    throw new Error("TEST_DATABASE_URL debe apuntar a una base local desechable");
}
process.env.DATABASE_URL = testDatabaseUrl;

const AMOUNT = 37_000;

// Remote status the fake Diem reports for every code request.
let remoteStatus = "delivered";
let created = 0;

function send(res: ServerResponse, body: unknown) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
}

function remoteRequest(id: string) {
    return { id, commercial_order_id: `order-${id}`, status: remoteStatus, external_reference: id };
}

async function fakeDiem(req: IncomingMessage, res: ServerResponse) {
    const url = req.url ?? "";
    if (req.method === "POST" && url === "/api/v1/code-requests/") {
        req.resume(); // body not needed
        created += 1;
        return send(res, remoteRequest(`remote-${created}`));
    }
    const match = url.match(/^\/api\/v1\/code-requests\/([^/]+)\/(reveal\/)?$/);
    if (match && req.method === "POST" && match[2]) {
        return send(res, { items: [{ codes: [`PIN-${match[1]}`] }] });
    }
    if (match && req.method === "GET") return send(res, remoteRequest(match[1]));
    res.writeHead(404).end();
}

const server = createServer((req, res) => {
    fakeDiem(req, res).catch(() => res.writeHead(500).end());
});

let prisma: typeof import("@/lib/prisma").default;
let bulk: typeof import("@/services/self-service/bulk-activate-cards.service");
let userId = "";
let companyId = "";

const READY = ["READYAAA", "READYBBB"];
const ACTIVATED = "DNEAAAAA";
const LOCKED = "LCKAAAAA";
const MISSING = "NPEAAAAA";

before(async () => {
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    process.env.DIEM_API_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    process.env.DIEM_SERVICE_API_KEY = "test-key";
    process.env.DIEM_STORE_ID = "00000000-0000-4000-8000-000000000000";
    prisma = (await import("@/lib/prisma")).default;
    bulk = await import("@/services/self-service/bulk-activate-cards.service");
});

after(async () => {
    await prisma.$disconnect();
    await new Promise((resolve) => server.close(resolve));
});

beforeEach(async () => {
    remoteStatus = "delivered";
    await prisma.rateLimitLog.deleteMany();
    await prisma.walletTransaction.deleteMany();
    await prisma.wallet.deleteMany();
    await prisma.activationAttempt.deleteMany();
    await prisma.cardActivation.deleteMany();
    await prisma.activationJob.deleteMany();
    await prisma.card.deleteMany();
    await prisma.key.deleteMany();
    await prisma.codePurchase.deleteMany();
    await prisma.productDenomination.deleteMany();
    await prisma.product.deleteMany();
    await prisma.user.deleteMany();
    await prisma.store.deleteMany();
    await prisma.company.deleteMany();

    const suffix = Math.random().toString(36).slice(2);
    const company = await prisma.company.create({
        data: { name: "Cliente Bloque", taxId: `NIT-${suffix}`, email: "b@test.local", phone: "1" },
    });
    const store = await prisma.store.create({
        data: { name: "Sede Norte", code: `ST-${suffix}`, address: "x", phone: "1", companyId: company.id },
    });
    const user = await prisma.user.create({
        data: { email: `ops-${suffix}@test.local`, name: "Ops Diem", role: "SYSTEM_ADMIN" },
    });
    const product = await prisma.product.create({
        data: { name: "Roblox", sku: `RBX-${suffix}`, brand: "Roblox" },
    });
    const denomination = await prisma.productDenomination.create({
        data: { productId: product.id, amount: AMOUNT, currency: "COP", devDiemProductId: `remote-rbx-${suffix}` },
    });
    const card = (uuid: string, extra: Record<string, unknown> = {}) => prisma.card.create({
        data: {
            uuid,
            qrData: `https://example.test/scan/${uuid}`,
            productId: product.id,
            denominationId: denomination.id,
            storeId: store.id,
            ...extra,
        },
    });
    await Promise.all([
        ...READY.map((uuid) => card(uuid)),
        card(ACTIVATED, { isActivated: true }),
        card(LOCKED, { activationLock: true, activationLockBy: user.id }),
    ]);
    await prisma.wallet.create({ data: { companyId: company.id, currency: "COP", balance: 50_000 } });
    userId = user.id;
    companyId = company.id;
});

const ALL = [...READY, ACTIVATED, LOCKED, MISSING];
const quoted = (uuid: string) => ({ uuid, quotedAmount: AMOUNT, quotedCurrency: "COP", quotedRate: null });

test("preview reports eligible, blocked and missing cards with the wallet projection", async () => {
    const preview = await bulk.previewBulkActivation({ uuids: ALL.map((u) => u.toLowerCase()), userId });

    assert.deepEqual(preview.missing, [MISSING]);
    assert.equal(preview.eligibleCount, 2);
    assert.equal(preview.blockedCount, 2);
    const reasons = Object.fromEntries(preview.cards.map((c) => [c.uuid, c.blockReason]));
    assert.equal(reasons[ACTIVATED], "Ya activada");
    assert.equal(reasons[LOCKED], "En proceso de activación");
    assert.equal(reasons[READY[0]], null);

    assert.equal(preview.companies.length, 1);
    const [summary] = preview.companies;
    assert.equal(summary.companyId, companyId);
    assert.deepEqual(summary.totals, [{ currency: "COP", amount: 2 * AMOUNT }]);
    assert.equal(summary.wallet.balanceAfter, 50_000 - 2 * AMOUNT);
});

test("a chunk activates only eligible cards, debits once each and is safe to re-send", async () => {
    const items = ALL.map(quoted);
    const first = await bulk.activateCardsChunk({ items, userId });
    const outcome = Object.fromEntries(first.results.map((r) => [r.uuid, r.outcome]));
    assert.equal(outcome[READY[0]], "COMPLETED");
    assert.equal(outcome[READY[1]], "COMPLETED");
    assert.equal(outcome[ACTIVATED], "SKIPPED");
    assert.equal(outcome[LOCKED], "SKIPPED");
    assert.equal(outcome[MISSING], "FAILED");

    const second = await bulk.activateCardsChunk({ items, userId });
    assert.ok(second.results.filter((r) => r.uuid !== MISSING).every((r) => r.outcome === "SKIPPED"));

    const [jobs, activations, consumptions, wallet, rateRows] = await Promise.all([
        prisma.activationJob.count(),
        prisma.cardActivation.count(),
        prisma.walletTransaction.findMany({ where: { type: "CONSUMPTION" } }),
        prisma.wallet.findUniqueOrThrow({ where: { companyId } }),
        prisma.rateLimitLog.count(),
    ]);
    assert.equal(jobs, 2);
    assert.equal(activations, 2);
    assert.equal(consumptions.length, 2);
    assert.equal(wallet.balance, 50_000 - 2 * AMOUNT);
    // Bulk is capped by its own limits, not the per-user counter of the QR flow.
    assert.equal(rateRows, 0);
});

test("a price change after the preview refuses the card instead of billing more", async () => {
    const { results } = await bulk.activateCardsChunk({
        items: [{ uuid: READY[0], quotedAmount: AMOUNT - 1, quotedCurrency: "COP", quotedRate: null }],
        userId,
    });
    assert.equal(results[0].outcome, "FAILED");
    assert.match(results[0].message ?? "", /tarifa cambió/);
    assert.equal(await prisma.activationJob.count(), 0);
    const card = await prisma.card.findUniqueOrThrow({ where: { uuid: READY[0] } });
    assert.equal(card.activationLock, false);
});

test("without stock in Diem the card stays in process and nothing is debited", async () => {
    remoteStatus = "awaiting_stock";
    const { results } = await bulk.activateCardsChunk({ items: [quoted(READY[0])], userId });
    assert.equal(results[0].outcome, "PROCESSING");
    assert.equal(results[0].status, "AWAITING_STOCK");
    assert.equal(await prisma.walletTransaction.count({ where: { type: "CONSUMPTION" } }), 0);
});

test("chunks above the limit are rejected", async () => {
    const items = "ABCDEFGHJKL".split("").map((c) => ({ uuid: `XXXXXXX${c}` }));
    await assert.rejects(bulk.activateCardsChunk({ items, userId }), /Máximo 10/);
});

test("malformed codes are rejected before touching any card", async () => {
    await assert.rejects(
        bulk.previewBulkActivation({ uuids: [READY[0], "READY0O1"], userId }),
        /Códigos QR inválidos: READY0O1/,
    );
    await assert.rejects(
        bulk.activateCardsChunk({ items: [quoted(READY[0]), { uuid: "corto" }], userId }),
        /Códigos QR inválidos: corto/,
    );
    assert.equal(await prisma.activationJob.count(), 0);
});

test("a scanned QR link is accepted as its code", async () => {
    const preview = await bulk.previewBulkActivation({
        uuids: [`https://app.vercode.me/scan/${READY[0].toLowerCase()}`],
        userId,
    });
    assert.equal(preview.eligibleCount, 1);
    assert.equal(preview.cards[0].uuid, READY[0]);
});
