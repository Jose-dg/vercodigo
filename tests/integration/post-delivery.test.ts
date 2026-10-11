/**
 * Diem events after SAS settled a delivery: cancellation refunds once, a code
 * replacement stores the new code without charging again.
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

let remoteStatus = "delivered";
let revealedCode = "CODE-A";

function send(res: ServerResponse, body: unknown) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
}

async function fakeDiem(req: IncomingMessage, res: ServerResponse) {
    const url = req.url ?? "";
    const id = url.split("/")[4] ?? "remote";
    if (req.method === "POST" && url.endsWith("/reveal/")) {
        return send(res, { items: [{ codes: [revealedCode] }] });
    }
    if (req.method === "GET" && url.startsWith("/api/v1/code-requests/")) {
        return send(res, { id, commercial_order_id: "order-1", status: remoteStatus, external_reference: "x" });
    }
    res.writeHead(404).end();
}

const server = createServer((req, res) => {
    fakeDiem(req, res).catch(() => res.writeHead(500).end());
});

let prisma: typeof import("@/lib/prisma").default;
let processCodePurchase: typeof import("@/services/self-service/purchase-codes.service").processCodePurchase;
let processActivationJob: typeof import("@/services/self-service/activate-card.service").processActivationJob;
let handleWebhook: typeof import("@/services/self-service/fulfillment-webhook.service").handleDiemFulfillmentWebhook;
let ids: { companyId: string; purchaseId: string; jobId: string; cardId: string };

const webhook = (kind: "PURCHASE" | "ACTIVATION", id: string, remoteId: string, toStatus: string) => JSON.stringify({
    event_id: `evt-${Math.random()}`,
    code_request_id: remoteId,
    external_reference: `DIEM-SAS-${kind}-${id}`,
    from_status: "delivered",
    to_status: toStatus,
    reason_code: "test",
    occurred_at: new Date().toISOString(),
});

async function walletState() {
    const [wallet, rows] = await Promise.all([
        prisma.wallet.findUniqueOrThrow({ where: { companyId: ids.companyId } }),
        prisma.walletTransaction.findMany({ orderBy: { createdAt: "asc" } }),
    ]);
    return {
        balance: wallet.balance,
        consumptions: rows.filter((row) => row.type === "CONSUMPTION"),
        refunds: rows.filter((row) => row.type === "REFUND"),
    };
}

before(async () => {
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    process.env.DIEM_API_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    process.env.DIEM_SERVICE_API_KEY = "test-key";
    process.env.DIEM_STORE_ID = "00000000-0000-4000-8000-000000000000";
    prisma = (await import("@/lib/prisma")).default;
    ({ processCodePurchase } = await import("@/services/self-service/purchase-codes.service"));
    ({ processActivationJob } = await import("@/services/self-service/activate-card.service"));
    ({ handleDiemFulfillmentWebhook: handleWebhook } = await import("@/services/self-service/fulfillment-webhook.service"));
});

after(async () => {
    await prisma.$disconnect();
    await new Promise((resolve) => server.close(resolve));
});

beforeEach(async () => {
    remoteStatus = "delivered";
    revealedCode = "CODE-A";
    await prisma.auditLog.deleteMany();
    await prisma.walletTransaction.deleteMany({ where: { reversalOfId: { not: null } } });
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
        data: { name: "Post SAS", taxId: `NIT-${suffix}`, email: "p@test.local", phone: "1" },
    });
    const store = await prisma.store.create({
        data: { name: "Tienda", code: `ST-${suffix}`, address: "x", phone: "1", companyId: company.id },
    });
    const user = await prisma.user.create({
        data: {
            email: `op-${suffix}@test.local`, passwordHash: "x", name: "Op",
            role: "OPERATOR", companyId: company.id, storeId: store.id,
        },
    });
    const product = await prisma.product.create({
        data: { name: "Gift", sku: `SKU-${suffix}`, brand: "Test", devDiemProductId: "remote-product-1" },
    });
    await prisma.wallet.create({ data: { companyId: company.id, currency: "COP" } });
    const purchase = await prisma.codePurchase.create({
        data: {
            companyId: company.id, storeId: store.id, userId: user.id, productId: product.id,
            count: 1, totalAmount: 36000, currency: "COP", appliedExchangeRate: 1,
            idempotencyKey: `idem-${suffix}`, status: "PENDING", diemRequestId: "remote-purchase",
        },
    });
    const card = await prisma.card.create({
        data: {
            uuid: `P${suffix}`.slice(0, 8).toUpperCase(), qrData: "x", productId: product.id,
            storeId: store.id, activationLock: true, activationLockBy: user.id,
        },
    });
    const job = await prisma.activationJob.create({
        data: {
            cardId: card.id, userId: user.id, storeId: store.id, status: "PROCESSING",
            idempotencyKey: `act-${suffix}`, diemRequestId: "remote-activation",
            commercialAmount: 37000, commercialCurrency: "COP",
        },
    });
    ids = { companyId: company.id, purchaseId: purchase.id, jobId: job.id, cardId: card.id };
});

test("Diem cancelling a delivered purchase refunds it exactly once, even if the webhook is replayed", async () => {
    await processCodePurchase(ids.purchaseId);
    assert.equal((await walletState()).balance, -36000);

    remoteStatus = "cancelled";
    const body = webhook("PURCHASE", ids.purchaseId, "remote-purchase", "cancelled");
    const [first, replay] = await Promise.all([handleWebhook(body), handleWebhook(body)]);
    const third = await handleWebhook(body);

    const purchase = await prisma.codePurchase.findUniqueOrThrow({ where: { id: ids.purchaseId } });
    const state = await walletState();
    assert.equal(purchase.status, "REVERSED");
    assert.equal(state.consumptions.length, 1);
    assert.equal(state.refunds.length, 1);
    assert.equal(state.refunds[0].reversalOfId, state.consumptions[0].id);
    assert.equal(state.balance, 0);
    assert.deepEqual(
        [first.reason, replay.reason, third.reason].filter((reason) => reason === "reversed"),
        ["reversed"],
    );
});

test("a webhook claiming cancellation is ignored while Diem still reports the delivery", async () => {
    await processCodePurchase(ids.purchaseId);
    await handleWebhook(webhook("PURCHASE", ids.purchaseId, "remote-purchase", "cancelled"));

    const purchase = await prisma.codePurchase.findUniqueOrThrow({ where: { id: ids.purchaseId } });
    assert.equal(purchase.status, "COMPLETED");
    assert.equal((await walletState()).refunds.length, 0);
});

test("a replaced code is stored without a second charge", async () => {
    await processCodePurchase(ids.purchaseId);
    remoteStatus = "delivery_pending";
    revealedCode = "CODE-B";

    const result = await handleWebhook(webhook("PURCHASE", ids.purchaseId, "remote-purchase", "delivery_pending"));

    const purchase = await prisma.codePurchase.findUniqueOrThrow({ where: { id: ids.purchaseId } });
    assert.equal(result.reason, "codes_replaced");
    assert.equal(purchase.status, "COMPLETED");
    assert.deepEqual(purchase.deliveredCodes, ["CODE-B"]);
    assert.equal((await walletState()).consumptions.length, 1);
});

test("Diem cancelling a delivered activation refunds its debit and keeps the audit trail", async () => {
    await processActivationJob(ids.jobId);
    assert.equal((await walletState()).balance, -37000);

    remoteStatus = "cancelled";
    await handleWebhook(webhook("ACTIVATION", ids.jobId, "remote-activation", "cancelled"));

    const [job, state, audit] = await Promise.all([
        prisma.activationJob.findUniqueOrThrow({ where: { id: ids.jobId } }),
        walletState(),
        prisma.auditLog.findMany({ where: { action: "ACTIVATION_REVERSED" } }),
    ]);
    assert.equal(job.status, "REVERSED");
    assert.equal(state.refunds.length, 1);
    assert.equal(state.balance, 0);
    assert.equal(audit.length, 1);
});

test("a replaced activation code repoints the card to the new key", async () => {
    await processActivationJob(ids.jobId);
    remoteStatus = "delivery_pending";
    revealedCode = "CODE-NEW";

    await handleWebhook(webhook("ACTIVATION", ids.jobId, "remote-activation", "delivery_pending"));

    const card = await prisma.card.findUniqueOrThrow({ where: { id: ids.cardId }, include: { key: true } });
    assert.equal(card.key?.code, "CODE-NEW");
    assert.equal((await walletState()).consumptions.length, 1);
});
