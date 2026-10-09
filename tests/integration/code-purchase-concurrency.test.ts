/**
 * Behavioural concurrency test for code purchase settlement.
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

type RemoteStatus = "delivered" | "processing" | "failed";
type RemoteScript = (call: number) => { status: RemoteStatus; delayMs: number };

const AMOUNT = 31_900;
let remoteScript: RemoteScript = () => ({ status: "delivered", delayMs: 0 });
let getCalls = 0;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function send(res: ServerResponse, body: unknown) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
}

async function fakeDiem(req: IncomingMessage, res: ServerResponse) {
    const url = req.url ?? "";
    const remote = (status: RemoteStatus) => ({
        id: "remote-request-1",
        commercial_order_id: "commercial-order-1",
        status,
        external_reference: "DIEM-SAS-PURCHASE-test",
    });
    if (req.method === "POST" && url === "/api/v1/code-requests/") {
        return send(res, remote("delivered"));
    }
    if (req.method === "POST" && url.endsWith("/reveal/")) {
        await sleep(20);
        // Diem reveal is idempotent: the same request always yields the same PIN.
        return send(res, { items: [{ codes: ["PIN-ONLY-ONE"] }] });
    }
    if (req.method === "GET" && url.startsWith("/api/v1/code-requests/")) {
        getCalls += 1;
        const { status, delayMs } = remoteScript(getCalls);
        await sleep(delayMs);
        return send(res, remote(status));
    }
    res.writeHead(404).end();
}

const server = createServer((req, res) => {
    fakeDiem(req, res).catch(() => res.writeHead(500).end());
});

// Loaded after DATABASE_URL points at the disposable database.
let prisma: typeof import("@/lib/prisma").default;
let processCodePurchase: typeof import("@/services/self-service/purchase-codes.service").processCodePurchase;
let purchaseId = "";
let companyId = "";

before(async () => {
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    process.env.DIEM_API_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    process.env.DIEM_SERVICE_API_KEY = "test-key";
    process.env.DIEM_STORE_ID = "00000000-0000-4000-8000-000000000000";
    prisma = (await import("@/lib/prisma")).default;
    ({ processCodePurchase } = await import("@/services/self-service/purchase-codes.service"));
});

after(async () => {
    await prisma.$disconnect();
    await new Promise((resolve) => server.close(resolve));
});

beforeEach(async () => {
    getCalls = 0;
    remoteScript = () => ({ status: "delivered", delayMs: 0 });
    await prisma.walletTransaction.deleteMany();
    await prisma.wallet.deleteMany();
    await prisma.codePurchase.deleteMany();
    await prisma.product.deleteMany();
    await prisma.user.deleteMany();
    await prisma.company.deleteMany();

    const suffix = Math.random().toString(36).slice(2);
    const company = await prisma.company.create({
        data: { name: "Concurrency SAS", taxId: `NIT-${suffix}`, email: "c@test.local", phone: "1" },
    });
    const user = await prisma.user.create({
        data: {
            email: `buyer-${suffix}@test.local`,
            passwordHash: "x",
            name: "Buyer Test",
            role: "SUPER_ADMIN",
            companyId: company.id,
        },
    });
    const product = await prisma.product.create({
        data: { name: "Gift Card", sku: `SKU-${suffix}`, brand: "Test", devDiemProductId: "remote-product-1" },
    });
    await prisma.wallet.create({ data: { companyId: company.id, currency: "COP" } });
    const purchase = await prisma.codePurchase.create({
        data: {
            companyId: company.id,
            userId: user.id,
            productId: product.id,
            count: 1,
            totalAmount: AMOUNT,
            currency: "COP",
            appliedExchangeRate: 1,
            idempotencyKey: `idem-${suffix}`,
            status: "PENDING",
        },
    });
    companyId = company.id;
    purchaseId = purchase.id;
});

async function ledger() {
    const [purchase, wallet, consumptions] = await Promise.all([
        prisma.codePurchase.findUniqueOrThrow({ where: { id: purchaseId } }),
        prisma.wallet.findUniqueOrThrow({ where: { companyId } }),
        prisma.walletTransaction.findMany({ where: { type: "CONSUMPTION" } }),
    ]);
    return { purchase, wallet, consumptions };
}

test("five concurrent processors settle once and debit once", async () => {
    const results = await Promise.allSettled(
        Array.from({ length: 5 }, () => processCodePurchase(purchaseId)),
    );

    assert.deepEqual(results.map((result) => result.status), Array(5).fill("fulfilled"));
    const { purchase, wallet, consumptions } = await ledger();
    assert.equal(purchase.status, "COMPLETED");
    assert.deepEqual(purchase.deliveredCodes, ["PIN-ONLY-ONE"]);
    assert.equal(consumptions.length, 1);
    assert.equal(consumptions[0].codePurchaseId, purchaseId);
    assert.equal(wallet.balance, -AMOUNT);
});

test("a late processor with a stale 'processing' response cannot reopen a settled purchase", async () => {
    // First GET is slow and stale; every later GET is fresh and delivered.
    remoteScript = (call) => (call === 1
        ? { status: "processing", delayMs: 400 }
        : { status: "delivered", delayMs: 0 });

    const late = processCodePurchase(purchaseId);
    await sleep(50);
    await processCodePurchase(purchaseId);
    await late;

    // A retry after the stale write must find a settled purchase, not debit again.
    await processCodePurchase(purchaseId);
    const { purchase, wallet, consumptions } = await ledger();
    assert.equal(purchase.status, "COMPLETED");
    assert.equal(consumptions.length, 1);
    assert.equal(wallet.balance, -AMOUNT);
});

test("a late 'failed' response cannot fail a completed purchase", async () => {
    remoteScript = (call) => (call === 1
        ? { status: "failed", delayMs: 400 }
        : { status: "delivered", delayMs: 0 });

    const late = processCodePurchase(purchaseId);
    await sleep(50);
    await processCodePurchase(purchaseId);
    const lateResult = await late;

    assert.equal(lateResult.status, "COMPLETED");
    const { purchase, consumptions } = await ledger();
    assert.equal(purchase.status, "COMPLETED");
    assert.equal(consumptions.length, 1);
});

test("the database rejects a second consumption for the same purchase", async () => {
    await processCodePurchase(purchaseId);
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { companyId } });
    await assert.rejects(
        prisma.walletTransaction.create({
            data: {
                walletId: wallet.id,
                type: "CONSUMPTION",
                status: "CONFIRMED",
                amount: AMOUNT,
                codePurchaseId: purchaseId,
            },
        }),
        (error: { code?: string }) => error.code === "P2002",
    );
});
