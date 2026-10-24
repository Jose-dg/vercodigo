/**
 * Company API keys and the public API v1, through the real route handlers.
 *
 * Runs against a disposable LOCAL PostgreSQL database and a fake Diem server.
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
process.env.API_KEY_PEPPER = "test-pepper-0123456789-0123456789-abcdef";

let createCalls: string[] = [];

async function readBody(req: IncomingMessage) {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks).toString("utf8");
}

async function fakeDiem(req: IncomingMessage, res: ServerResponse) {
    const url = req.url ?? "";
    res.setHeader("Content-Type", "application/json");
    if (req.method === "POST" && url === "/api/v1/code-requests/") {
        createCalls.push(await readBody(req));
        res.writeHead(201);
        return res.end(JSON.stringify({ id: `remote-${createCalls.length}`, commercial_order_id: "o1", status: "received", external_reference: "x" }));
    }
    if (req.method === "GET" && url.startsWith("/api/v1/code-requests/")) {
        res.writeHead(200);
        return res.end(JSON.stringify({ id: url.split("/")[4], commercial_order_id: "o1", status: "awaiting_stock", external_reference: "x" }));
    }
    res.writeHead(404).end();
}

const server = createServer((req, res) => {
    fakeDiem(req, res).catch(() => res.writeHead(500).end());
});

type Handler = (req: import("next/server").NextRequest, ctx: unknown) => Promise<Response>;
let prisma: typeof import("@/lib/prisma").default;
let NextRequestCtor: typeof import("next/server").NextRequest;
let keys: typeof import("@/modules/api-keys/service");
let routes: {
    wallet: Handler;
    createDelivery: Handler;
    getDelivery: Handler;
    catalog: Handler;
    listOrders: Handler;
    listTransactions: Handler;
    getTransaction: Handler;
    rates: Handler;
};
let ctx: {
    owner: { id: string; role: "OWNER"; companyId: string };
    otherOwner: { id: string; role: "OWNER"; companyId: string };
    productId: string;
    denominationId: string;
};

function call(handler: Handler, key: string | null, init: { method?: string; path?: string; body?: unknown; idem?: string; id?: string } = {}) {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (key) headers.Authorization = `Bearer ${key}`;
    if (init.idem) headers["Idempotency-Key"] = init.idem;
    const req = new NextRequestCtor(`http://localhost${init.path ?? "/api/v1/x"}`, {
        method: init.method ?? "GET",
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    return handler(req, { params: Promise.resolve({ id: init.id ?? "" }) });
}

const delivery = (email = "luis@cliente.co") => ({
    product_id: ctx.productId,
    denomination_id: ctx.denominationId,
    quantity: 1,
    recipient: { first_name: "Luis", last_name: "Gómez", email },
});

before(async () => {
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    process.env.DIEM_API_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    process.env.DIEM_SERVICE_API_KEY = "test-key";
    process.env.DIEM_STORE_ID = "00000000-0000-4000-8000-000000000000";
    prisma = (await import("@/lib/prisma")).default;
    ({ NextRequest: NextRequestCtor } = await import("next/server"));
    keys = await import("@/modules/api-keys/service");
    routes = {
        wallet: (await import("@/app/api/v1/wallet/route")).GET as Handler,
        createDelivery: (await import("@/app/api/v1/deliveries/route")).POST as Handler,
        getDelivery: (await import("@/app/api/v1/deliveries/[id]/route")).GET as Handler,
        catalog: (await import("@/app/api/v1/catalog/route")).GET as Handler,
        listOrders: (await import("@/app/api/v1/orders/route")).GET as Handler,
        listTransactions: (await import("@/app/api/v1/transactions/route")).GET as Handler,
        getTransaction: (await import("@/app/api/v1/transactions/[id]/route")).GET as Handler,
        rates: (await import("@/app/api/v1/rates/route")).GET as Handler,
    };
});

after(async () => {
    // Other suites delete companies and do not know about API keys.
    await prisma.apiRateWindow.deleteMany();
    await prisma.sandboxDelivery.deleteMany();
    await prisma.companyApiKey.deleteMany();
    await prisma.$disconnect();
    await new Promise((resolve) => server.close(resolve));
});

beforeEach(async () => {
    createCalls = [];
    await prisma.apiRateWindow.deleteMany();
    await prisma.sandboxDelivery.deleteMany();
    await prisma.companyApiKey.deleteMany();
    await prisma.auditLog.deleteMany();
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

    const makeCompany = async (label: string) => {
        const suffix = Math.random().toString(36).slice(2);
        const company = await prisma.company.create({
            data: { name: `${label} SAS`, taxId: `NIT-${suffix}`, email: `${suffix}@test.local`, phone: "1" },
        });
        const store = await prisma.store.create({
            data: { name: "Sede", code: `ST-${suffix}`, address: "x", phone: "1", companyId: company.id },
        });
        const owner = await prisma.user.create({
            data: {
                email: `owner-${suffix}@test.local`, name: `${label} Owner`, role: "OWNER",
                companyId: company.id, storeId: store.id,
            },
        });
        await prisma.wallet.create({ data: { companyId: company.id, currency: "COP" } });
        return { id: owner.id, role: "OWNER" as const, companyId: company.id };
    };
    const owner = await makeCompany("Alfa");
    const otherOwner = await makeCompany("Beta");
    const suffix = Math.random().toString(36).slice(2);
    const product = await prisma.product.create({
        data: { name: "Netflix", sku: `SKU-${suffix}`, brand: "Netflix", devDiemProductId: `remote-product-${suffix}` },
    });
    const denomination = await prisma.productDenomination.create({
        data: { productId: product.id, amount: 85000, currency: "COP", devDiemProductId: `remote-denom-${suffix}` },
    });
    ctx = { owner, otherOwner, productId: product.id, denominationId: denomination.id };
});

test("a key works until it is revoked, and the database never holds it in clear", async () => {
    const { key, apiKey } = await keys.createApiKey(ctx.owner, { name: "ERP", scopes: ["wallet:read"], environment: "LIVE" });

    const ok = await call(routes.wallet, key);
    assert.equal(ok.status, 200);
    assert.deepEqual((await ok.json()).balance, { amount: 0, currency: "COP" });

    const stored = await prisma.companyApiKey.findUniqueOrThrow({ where: { id: apiKey.id } });
    assert.notEqual(stored.keyHash, key);
    assert.ok(!JSON.stringify(stored).includes(key.split("_")[3]));
    assert.ok(stored.lastUsedAt);

    await keys.revokeApiKey(ctx.owner, apiKey.id);
    await keys.revokeApiKey(ctx.owner, apiKey.id);
    assert.equal((await call(routes.wallet, key)).status, 401);
    assert.equal(await prisma.auditLog.count({ where: { action: "API_KEY_REVOKED" } }), 1);
});

test("missing scope is 403, a bad key is 401 and the limit is five active keys", async () => {
    const { key } = await keys.createApiKey(ctx.owner, { name: "Solo saldo", scopes: ["wallet:read"] });
    assert.equal((await call(routes.catalog, key)).status, 403);
    assert.equal((await call(routes.wallet, `${key.slice(0, -2)}xx`)).status, 401);
    assert.equal((await call(routes.wallet, null)).status, 401);

    for (let index = 1; index < 5; index += 1) {
        await keys.createApiKey(ctx.owner, { name: `k${index}`, scopes: ["wallet:read"] });
    }
    await assert.rejects(
        () => keys.createApiKey(ctx.owner, { name: "sexta", scopes: ["wallet:read"] }),
        /5 API keys sandbox activas/,
    );
    // The limit is per environment: sandbox keys do not block production ones.
    await keys.createApiKey(ctx.owner, { name: "prod", scopes: ["wallet:read"], environment: "LIVE" });
});

test("an API delivery is idempotent, emails the recipient and stays inside its company", async () => {
    const { key } = await keys.createApiKey(ctx.owner, {
        name: "ERP", scopes: ["deliveries:create", "deliveries:read"], environment: "LIVE",
    });
    const first = await call(routes.createDelivery, key, { method: "POST", body: delivery(), idem: "order-77" });
    assert.equal(first.status, 201, await first.clone().text());
    const created = await first.json();
    const replay = await (await call(routes.createDelivery, key, { method: "POST", body: delivery(), idem: "order-77" })).json();

    assert.equal(replay.id, created.id);
    assert.equal(await prisma.codePurchase.count(), 1);
    assert.equal(createCalls.length, 1);
    const sent = JSON.parse(createCalls[0]);
    assert.equal(sent.delivery_mode, "managed_and_partner");
    assert.equal(sent.recipient.email, "luis@cliente.co");
    assert.equal(sent.metadata.channel, "api");
    assert.deepEqual(created.recipient, { first_name: "Luis", last_name: "Gómez", email: "luis@cliente.co" });
    assert.equal(created.status, "awaiting_stock");
    assert.equal("keys" in created, false);

    const conflict = await call(routes.createDelivery, key, { method: "POST", body: delivery("otro@cliente.co"), idem: "order-77" });
    assert.equal(conflict.status, 409);

    const own = await call(routes.getDelivery, key, { id: created.id });
    assert.equal(own.status, 200);
    const { key: otherKey } = await keys.createApiKey(ctx.otherOwner, { name: "Beta", scopes: ["deliveries:read"], environment: "LIVE" });
    assert.equal((await call(routes.getDelivery, otherKey, { id: created.id })).status, 404);
});

test("a key stops working when its creator is deactivated", async () => {
    const { key } = await keys.createApiKey(ctx.owner, { name: "ERP", scopes: ["wallet:read"] });
    await prisma.user.update({ where: { id: ctx.owner.id }, data: { isActive: false } });
    assert.equal((await call(routes.wallet, key)).status, 401);
});

test("keys belong to their company: the platform and other companies cannot see or touch them", async () => {
    const platform = { id: ctx.owner.id, role: "SUPER_ADMIN" as const, companyId: null };
    const { apiKey } = await keys.createApiKey(ctx.owner, { name: "ERP", scopes: ["wallet:read"] });
    await assert.rejects(() => keys.createApiKey(platform, { name: "x", scopes: ["wallet:read"] }), /Solo el dueño/);
    await assert.rejects(() => keys.listApiKeys(platform), /Solo el dueño/);
    await assert.rejects(() => keys.revokeApiKey(platform, apiKey.id), /Solo el dueño/);
    await assert.rejects(() => keys.revokeApiKey(ctx.otherOwner, apiKey.id), /no encontrada/);
    assert.deepEqual((await keys.listApiKeys(ctx.otherOwner)).map((row) => row.id), []);
    assert.deepEqual((await keys.listApiKeys(ctx.owner)).map((row) => row.id), [apiKey.id]);
});

test("deleting a key hides and invalidates it while preserving its record and audit trail", async () => {
    const { key, apiKey } = await keys.createApiKey(ctx.owner, { name: "Temporal", scopes: ["wallet:read"] });
    const historicalDelivery = await prisma.sandboxDelivery.create({
        data: {
            companyId: ctx.owner.companyId,
            apiKeyId: apiKey.id,
            idempotencyKey: `delete-history-${Math.random()}`,
            productId: ctx.productId,
            denominationId: ctx.denominationId,
            quantity: 1,
            unitAmount: 85000,
            currency: "COP",
            recipientFirstName: "Luis",
            recipientLastName: "Gómez",
            recipientEmail: "luis@cliente.co",
            status: "completed",
            emailDelivery: "sent",
        },
    });
    await assert.rejects(() => keys.deleteApiKey(ctx.otherOwner, apiKey.id), /no encontrada/);

    await keys.deleteApiKey(ctx.owner, apiKey.id);
    assert.deepEqual(await keys.listApiKeys(ctx.owner), []);
    assert.equal((await call(routes.wallet, key)).status, 401);

    const stored = await prisma.companyApiKey.findUniqueOrThrow({ where: { id: apiKey.id } });
    assert.ok(stored.deletedAt);
    assert.equal(stored.deletedById, ctx.owner.id);
    assert.ok(stored.revokedAt);
    assert.equal(await prisma.sandboxDelivery.count({ where: { id: historicalDelivery.id } }), 1);
    assert.equal(await prisma.auditLog.count({ where: { action: "API_KEY_DELETED", entityId: apiKey.id } }), 1);
});

test("a sandbox key simulates deliveries without touching money, Diem or the portal", async () => {
    const { key: sandbox } = await keys.createApiKey(ctx.owner, {
        name: "Pruebas", scopes: ["deliveries:create", "deliveries:read", "wallet:read"],
    });
    assert.match(sandbox, /^vck_test_/);

    const first = await call(routes.createDelivery, sandbox, { method: "POST", body: delivery("luis+fail@ejemplo.com"), idem: "prueba-1" });
    assert.equal(first.status, 201, await first.clone().text());
    const created = await first.json();
    assert.equal(created.livemode, false);
    assert.equal(created.status, "completed");
    assert.equal(created.email_delivery, "failed");
    assert.deepEqual(created.total, { amount: 85000, currency: "COP" });

    const replay = await (await call(routes.createDelivery, sandbox, { method: "POST", body: delivery("luis+fail@ejemplo.com"), idem: "prueba-1" })).json();
    assert.equal(replay.id, created.id);
    assert.equal((await call(routes.createDelivery, sandbox, { method: "POST", body: delivery("otro@ejemplo.com"), idem: "prueba-1" })).status, 409);

    // Nothing real happened.
    assert.equal(createCalls.length, 0);
    assert.equal(await prisma.codePurchase.count(), 0);
    assert.equal(await prisma.walletTransaction.count(), 0);
    const wallet = await (await call(routes.wallet, sandbox)).json();
    assert.equal(wallet.livemode, false);
    assert.equal((await prisma.wallet.findUniqueOrThrow({ where: { companyId: ctx.owner.companyId } })).balance, 0);

    // Each environment only sees its own deliveries.
    assert.equal((await call(routes.getDelivery, sandbox, { id: created.id })).status, 200);
    const { key: live } = await keys.createApiKey(ctx.owner, { name: "Prod", scopes: ["deliveries:read"], environment: "LIVE" });
    assert.equal((await call(routes.getDelivery, live, { id: created.id })).status, 404);

    const orders = await (await call(routes.listOrders, sandbox, { path: "/api/v1/orders?limit=1" })).json();
    assert.equal(orders.livemode, false);
    assert.equal(orders.data.length, 1);
    assert.equal("keys" in orders.data[0], false);
    const transactions = await (await call(routes.listTransactions, sandbox)).json();
    assert.deepEqual(transactions.data, []);
});

test("public order, rate and transaction reads stay scoped to the key company", async () => {
    const { key } = await keys.createApiKey(ctx.owner, {
        name: "Lecturas",
        scopes: ["catalog:read", "deliveries:read", "wallet:read"],
        environment: "LIVE",
    });
    const otherPurchase = await prisma.codePurchase.create({
        data: {
            companyId: ctx.otherOwner.companyId,
            userId: ctx.otherOwner.id,
            productId: ctx.productId,
            denominationId: ctx.denominationId,
            count: 1,
            totalAmount: 85000,
            currency: "COP",
            status: "COMPLETED",
            idempotencyKey: `other-${Math.random()}`,
        },
    });
    const ownPurchase = await prisma.codePurchase.create({
        data: {
            companyId: ctx.owner.companyId,
            userId: ctx.owner.id,
            productId: ctx.productId,
            denominationId: ctx.denominationId,
            count: 1,
            totalAmount: 85000,
            currency: "COP",
            status: "COMPLETED",
            idempotencyKey: `own-${Math.random()}`,
        },
    });
    const orders = await (await call(routes.listOrders, key, { path: "/api/v1/orders?limit=1" })).json();
    assert.equal(orders.data[0].id, ownPurchase.id);
    assert.ok(!JSON.stringify(orders).includes(otherPurchase.id));
    assert.equal("keys" in orders.data[0], false);

    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { companyId: ctx.owner.companyId } });
    const transaction = await prisma.walletTransaction.create({
        data: {
            walletId: wallet.id,
            type: "ADJUSTMENT",
            status: "CONFIRMED",
            amount: 1000,
            balanceAfter: 1000,
            description: "Ajuste de prueba",
            occurredAtSource: "LEDGER_EVENT",
        },
    });
    const transactions = await (await call(routes.listTransactions, key, { path: "/api/v1/transactions?limit=10" })).json();
    assert.equal(transactions.data[0].id, transaction.id);
    assert.equal((await call(routes.getTransaction, key, { id: transaction.id })).status, 200);

    const rates = await call(routes.rates, key);
    assert.equal(rates.status, 200);
    assert.equal((await rates.json()).object, "list");
});

test("requests over the limit are throttled", async () => {
    const { apiKey } = await keys.createApiKey(ctx.owner, { name: "ERP", scopes: ["wallet:read"] });
    const now = new Date("2026-10-22T10:00:30Z");
    assert.equal(await keys.consumeApiRateLimit(apiKey.id, now, 2), null);
    assert.equal(await keys.consumeApiRateLimit(apiKey.id, now, 2), null);
    assert.equal(await keys.consumeApiRateLimit(apiKey.id, now, 2), 30);
    assert.equal(await keys.consumeApiRateLimit(apiKey.id, new Date("2026-10-22T10:01:00Z"), 2), null);
});
