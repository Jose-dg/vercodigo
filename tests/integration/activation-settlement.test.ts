/**
 * Behavioural test for QR card activation settlement.
 *
 * Runs the real service against a disposable LOCAL PostgreSQL database and a
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

function send(res: ServerResponse, body: unknown) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
}

async function fakeDiem(req: IncomingMessage, res: ServerResponse) {
    const url = req.url ?? "";
    if (req.method === "POST" && url.endsWith("/reveal/")) {
        return send(res, { items: [{ codes: ["ROBLOX-PIN-1"] }] });
    }
    if (req.method === "GET" && url.startsWith("/api/v1/code-requests/")) {
        return send(res, {
            id: "remote-activation-1",
            commercial_order_id: "commercial-order-1",
            status: "delivered",
            external_reference: "DIEM-SAS-ACTIVATION-test",
        });
    }
    res.writeHead(404).end();
}

const server = createServer((req, res) => {
    fakeDiem(req, res).catch(() => res.writeHead(500).end());
});

let prisma: typeof import("@/lib/prisma").default;
let processActivationJob: typeof import("@/services/self-service/activate-card.service").processActivationJob;
let jobId = "";
let cardId = "";
let storeId = "";
let userId = "";

before(async () => {
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    process.env.DIEM_API_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    process.env.DIEM_SERVICE_API_KEY = "test-key";
    process.env.DIEM_STORE_ID = "00000000-0000-4000-8000-000000000000";
    prisma = (await import("@/lib/prisma")).default;
    ({ processActivationJob } = await import("@/services/self-service/activate-card.service"));
});

after(async () => {
    await prisma.$disconnect();
    await new Promise((resolve) => server.close(resolve));
});

beforeEach(async () => {
    await prisma.walletTransaction.deleteMany();
    await prisma.wallet.deleteMany();
    await prisma.activationAttempt.deleteMany();
    await prisma.cardActivation.deleteMany();
    await prisma.activationJob.deleteMany();
    await prisma.card.deleteMany();
    await prisma.key.deleteMany();
    await prisma.codePurchase.deleteMany();
    await prisma.product.deleteMany();
    await prisma.user.deleteMany();
    await prisma.store.deleteMany();
    await prisma.company.deleteMany();

    const suffix = Math.random().toString(36).slice(2);
    const company = await prisma.company.create({
        data: { name: "Activation SAS", taxId: `NIT-${suffix}`, email: "a@test.local", phone: "1" },
    });
    const store = await prisma.store.create({
        data: { name: "Tienda QR", code: `ST-${suffix}`, address: "x", phone: "1", companyId: company.id },
    });
    const user = await prisma.user.create({
        data: {
            email: `operator-${suffix}@test.local`,
            passwordHash: "x",
            name: "Operador QR",
            role: "OPERATOR",
            companyId: company.id,
            storeId: store.id,
        },
    });
    const product = await prisma.product.create({
        data: { name: "Roblox", sku: `RBX-${suffix}`, brand: "Roblox", devDiemProductId: "remote-roblox-10" },
    });
    const card = await prisma.card.create({
        data: {
            uuid: `QR${suffix}`.slice(0, 8).toUpperCase(),
            qrData: `https://example.test/scan/${suffix}`,
            productId: product.id,
            storeId: store.id,
            activationLock: true,
            activationLockBy: user.id,
        },
    });
    await prisma.wallet.create({ data: { companyId: company.id, currency: "COP" } });
    const job = await prisma.activationJob.create({
        data: {
            cardId: card.id,
            userId: user.id,
            storeId: store.id,
            status: "AWAITING_STOCK",
            idempotencyKey: `diem-sas-activation:${suffix}`,
            diemRequestId: "remote-activation-1",
            commercialAmount: AMOUNT,
            commercialCurrency: "COP",
        },
    });
    jobId = job.id;
    cardId = card.id;
    storeId = store.id;
    userId = user.id;
});

test("concurrent processors activate the card once and debit once", async () => {
    const results = await Promise.allSettled(
        Array.from({ length: 4 }, () => processActivationJob(jobId)),
    );
    assert.equal(results.filter((row) => row.status === "rejected").length, 0);
    const [job, card, activations, consumptions] = await Promise.all([
        prisma.activationJob.findUniqueOrThrow({ where: { id: jobId } }),
        prisma.card.findUniqueOrThrow({ where: { id: cardId } }),
        prisma.cardActivation.findMany(),
        prisma.walletTransaction.findMany({ where: { type: "CONSUMPTION" } }),
    ]);
    assert.equal(job.status, "COMPLETED");
    assert.equal(card.isActivated, true);
    assert.equal(activations.length, 1);
    assert.equal(consumptions.length, 1);
    assert.equal(consumptions[0].amount, AMOUNT);
    assert.equal(consumptions[0].cardActivationId, activations[0].id);
});

test("a card already activated elsewhere never leaves a COMPLETED job without its debit", async () => {
    // Another path (e.g. the legacy WhatsApp webhook) activated the card first.
    await prisma.card.update({ where: { id: cardId }, data: { isActivated: true } });
    await prisma.cardActivation.create({
        data: { cardId, storeId, activatedBy: userId, activationAmount: 10 },
    });

    const result = await processActivationJob(jobId);

    const [job, consumptions] = await Promise.all([
        prisma.activationJob.findUniqueOrThrow({ where: { id: jobId } }),
        prisma.walletTransaction.findMany({ where: { type: "CONSUMPTION" } }),
    ]);
    assert.equal(result.status, "ACTION_REQUIRED");
    assert.equal(job.status, "ACTION_REQUIRED");
    assert.deepEqual(job.deliveredCodes, ["ROBLOX-PIN-1"]);
    assert.match(job.lastError ?? "", /ya estaba activada/);
    assert.equal(consumptions.length, 0);
});
