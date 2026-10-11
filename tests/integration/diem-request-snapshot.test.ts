/**
 * Retries must resend the exact command Diem hashed behind the Idempotency-Key.
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

type CreateBehaviour = (call: number) => { status: number; body: unknown };

let createCalls: Array<{ key: string | undefined; body: string }> = [];
let createBehaviour: CreateBehaviour = () => ({ status: 201, body: {} });

async function readBody(req: IncomingMessage) {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks).toString("utf8");
}

async function fakeDiem(req: IncomingMessage, res: ServerResponse) {
    const url = req.url ?? "";
    if (req.method === "POST" && url === "/api/v1/code-requests/") {
        const body = await readBody(req);
        createCalls.push({ key: req.headers["idempotency-key"] as string | undefined, body });
        const { status, body: response } = createBehaviour(createCalls.length);
        res.writeHead(status, { "Content-Type": "application/json" });
        return res.end(JSON.stringify(response));
    }
    if (req.method === "GET" && url.startsWith("/api/v1/code-requests/")) {
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({
            id: "remote-1", commercial_order_id: "order-1", status: "awaiting_stock", external_reference: "x",
        }));
    }
    res.writeHead(404).end();
}

const server = createServer((req, res) => {
    fakeDiem(req, res).catch(() => res.writeHead(500).end());
});

let prisma: typeof import("@/lib/prisma").default;
let processCodePurchase: typeof import("@/services/self-service/purchase-codes.service").processCodePurchase;
let processActivationJob: typeof import("@/services/self-service/activate-card.service").processActivationJob;
let ids: { userId: string; purchaseId: string; jobId: string; cardId: string; storeId: string };

before(async () => {
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    process.env.DIEM_API_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    process.env.DIEM_SERVICE_API_KEY = "test-key";
    process.env.DIEM_STORE_ID = "00000000-0000-4000-8000-000000000000";
    prisma = (await import("@/lib/prisma")).default;
    ({ processCodePurchase } = await import("@/services/self-service/purchase-codes.service"));
    ({ processActivationJob } = await import("@/services/self-service/activate-card.service"));
});

after(async () => {
    await prisma.$disconnect();
    await new Promise((resolve) => server.close(resolve));
});

beforeEach(async () => {
    createCalls = [];
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
        data: { name: "Snapshot SAS", taxId: `NIT-${suffix}`, email: "s@test.local", phone: "1" },
    });
    const store = await prisma.store.create({
        data: { name: "Tienda Uno", code: `ST-${suffix}`, address: "x", phone: "1", companyId: company.id },
    });
    const user = await prisma.user.create({
        data: {
            email: `buyer-${suffix}@test.local`, passwordHash: "x", name: "Ana Ruiz",
            role: "OPERATOR", companyId: company.id, storeId: store.id,
        },
    });
    const product = await prisma.product.create({
        data: { name: "Gift Card", sku: `SKU-${suffix}`, brand: "Test", devDiemProductId: "remote-product-1" },
    });
    await prisma.wallet.create({ data: { companyId: company.id, currency: "COP" } });
    const purchase = await prisma.codePurchase.create({
        data: {
            companyId: company.id, storeId: store.id, userId: user.id, productId: product.id,
            count: 1, totalAmount: 36000, currency: "COP",
            idempotencyKey: `idem-${suffix}`, status: "PENDING",
        },
    });
    const card = await prisma.card.create({
        data: {
            uuid: `S${suffix}`.slice(0, 8).toUpperCase(), qrData: "x", productId: product.id,
            storeId: store.id, activationLock: true, activationLockBy: user.id,
        },
    });
    const job = await prisma.activationJob.create({
        data: {
            cardId: card.id, userId: user.id, storeId: store.id, status: "PENDING",
            idempotencyKey: `diem-sas-activation:${suffix}`,
            commercialAmount: 37000, commercialCurrency: "COP",
        },
    });
    ids = { userId: user.id, purchaseId: purchase.id, jobId: job.id, cardId: card.id, storeId: store.id };
});

test("a retry after a lost Diem response resends the identical command even if live data changed", async () => {
    // First attempt: Diem accepted it but the response never reached SAS.
    createBehaviour = (call) => (call === 1
        ? { status: 502, body: { detail: "upstream timeout" } }
        : { status: 201, body: { id: "remote-1", commercial_order_id: "order-1", status: "received", external_reference: "x" } });

    await assert.rejects(() => processCodePurchase(ids.purchaseId));

    await prisma.user.update({ where: { id: ids.userId }, data: { name: "Ana María Ruiz Gómez" } });
    await prisma.store.update({ where: { id: ids.storeId }, data: { name: "Tienda Renombrada" } });

    await processCodePurchase(ids.purchaseId);

    assert.equal(createCalls.length, 2);
    assert.equal(createCalls[0].key, createCalls[1].key);
    assert.equal(createCalls[0].body, createCalls[1].body);
    const purchase = await prisma.codePurchase.findUniqueOrThrow({ where: { id: ids.purchaseId } });
    assert.equal(purchase.diemRequestId, "remote-1");
    assert.ok(purchase.diemRequestSnapshot);
});

test("an idempotency 409 parks the activation for review and keeps the card locked", async () => {
    createBehaviour = () => ({
        status: 409,
        body: { detail: "Idempotency key was already used with a different payload" },
    });

    await assert.rejects(() => processActivationJob(ids.jobId));

    const [job, card] = await Promise.all([
        prisma.activationJob.findUniqueOrThrow({ where: { id: ids.jobId } }),
        prisma.card.findUniqueOrThrow({ where: { id: ids.cardId } }),
    ]);
    assert.equal(job.status, "ACTION_REQUIRED");
    assert.match(job.lastError ?? "", /idempotencia/);
    assert.equal(card.activationLock, true);
});
