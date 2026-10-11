/**
 * Behavioural tests for company wallet top-ups and movement queries.
 *
 * Runs the real services against a disposable LOCAL PostgreSQL database and a
 * fake DevDiem HTTP server. It refuses to run against any non-local database.
 *
 *   TEST_DATABASE_URL=postgresql://<user>@localhost:5432/diemsas_concurrency_test \
 *     npm run test:concurrency
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, beforeEach, test } from "node:test";

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
if (!testDatabaseUrl) throw new Error("TEST_DATABASE_URL es obligatoria");
if (!["localhost", "127.0.0.1", "::1"].includes(new URL(testDatabaseUrl).hostname)) {
    throw new Error("TEST_DATABASE_URL debe apuntar a una base local desechable");
}
process.env.DATABASE_URL = testDatabaseUrl;

const acknowledged: string[] = [];
// What the fake DevDiem reports for GET /topups/<id>/.
const remoteTopUps = new Map<string, Record<string, unknown>>();
const server = createServer((req, res) => {
    const url = req.url ?? "";
    const match = /\/topups\/([^/]+)\/acknowledge\/$/.exec(url);
    if (req.method === "POST" && match) acknowledged.push(decodeURIComponent(match[1]));
    const detail = /\/topups\/([^/]+)\/$/.exec(url);
    if (req.method === "GET" && detail) {
        const topUp = remoteTopUps.get(decodeURIComponent(detail[1]));
        res.writeHead(topUp ? 200 : 404, { "Content-Type": "application/json" });
        res.end(JSON.stringify(topUp ?? { detail: "Not found." }));
        return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end("{}");
});

// Loaded after DATABASE_URL points at the disposable database.
let prisma: typeof import("@/lib/prisma").default;
let wallet: typeof import("@/services/wallet/wallet.service");
let gateway: typeof import("@/services/wallet/gateway-topup.service");
let verifyLedger: typeof import("@/lib/wallet/ledger-verification").verifyLedger;
let fingerprint: typeof import("@/lib/wallet/recharge-request").manualRechargeFingerprint;
let defineAbilitiesFor: typeof import("@/lib/auth/abilities").defineAbilitiesFor;
let AppError: typeof import("@/lib/errors").AppError;

let companyId = "";
let otherCompanyId = "";
let actorId = "";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function removeStatements() {
    // Issued statements are immutable by trigger; this disposable database
    // bypasses it only to reset fixtures between tests.
    await prisma.$transaction([
        prisma.$executeRawUnsafe("SET LOCAL session_replication_role = replica"),
        prisma.$executeRawUnsafe('DELETE FROM "AccountStatementLine"'),
        prisma.$executeRawUnsafe('DELETE FROM "AccountStatement"'),
    ]);
}

function manual(params: { amount: number; occurredAt: Date; reference: string; key: string; company?: string }) {
    const target = params.company ?? companyId;
    return wallet.recharge({
        companyId: target,
        amount: params.amount,
        occurredAt: params.occurredAt,
        occurredAtSource: "PAYMENT",
        method: "MANUAL",
        externalReference: params.reference,
        idempotencyKey: params.key,
        requestFingerprint: fingerprint({
            companyId: target,
            amount: params.amount,
            occurredAt: params.occurredAt,
            externalReference: params.reference,
        }),
        actorId,
    });
}

async function rejectsWith(promise: Promise<unknown>, status: number, code?: string) {
    await assert.rejects(promise, (error: unknown) => {
        assert.ok(error instanceof AppError, String(error));
        assert.equal(error.status, status);
        if (code) assert.equal(error.code, code);
        return true;
    });
}

async function ledgerFindings() {
    const wallets = await prisma.wallet.findMany({ include: { transactions: true } });
    return verifyLedger(
        wallets.map((row) => ({ id: row.id, companyId: row.companyId, balance: row.balance, rows: row.transactions })),
        [],
    ).findings;
}

before(async () => {
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    process.env.DIEM_API_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    process.env.DIEM_SERVICE_API_KEY = "test-key";
    process.env.DIEM_STORE_ID = "00000000-0000-4000-8000-000000000000";
    prisma = (await import("@/lib/prisma")).default;
    wallet = await import("@/services/wallet/wallet.service");
    gateway = await import("@/services/wallet/gateway-topup.service");
    ({ verifyLedger } = await import("@/lib/wallet/ledger-verification"));
    ({ manualRechargeFingerprint: fingerprint } = await import("@/lib/wallet/recharge-request"));
    ({ defineAbilitiesFor } = await import("@/lib/auth/abilities"));
    ({ AppError } = await import("@/lib/errors"));
});

after(async () => {
    await removeStatements();
    await prisma.$disconnect();
    await new Promise((resolve) => server.close(resolve));
});

beforeEach(async () => {
    acknowledged.length = 0;
    remoteTopUps.clear();
    await removeStatements();
    await prisma.walletTransaction.deleteMany();
    await prisma.wallet.deleteMany();
    // Other integration files share this disposable database.
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
    const [company, other] = await Promise.all([
        prisma.company.create({ data: { name: "Wallet SAS", taxId: `NIT-${suffix}`, email: "w@test.local", phone: "1" } }),
        prisma.company.create({ data: { name: "Other SAS", taxId: `NIT-O-${suffix}`, email: "o@test.local", phone: "2" } }),
    ]);
    const user = await prisma.user.create({
        data: { email: `platform-${suffix}@test.local`, passwordHash: "x", name: "Platform", role: "SUPER_ADMIN" },
    });
    companyId = company.id;
    otherCompanyId = other.id;
    actorId = user.id;
    await wallet.getOrCreateWallet(companyId);
    await wallet.getOrCreateWallet(otherCompanyId);
    await sleep(5);
});

test("a manual top-up keeps the payment time apart from its registration and reorders later balances", async () => {
    await wallet.debit({ companyId, amount: 100_000, currency: "COP" });
    await sleep(30);
    const between = new Date();
    await sleep(30);
    await wallet.debit({ companyId, amount: 50_000, currency: "COP" });

    const { transaction, replayed } = await manual({
        amount: 300_000,
        occurredAt: between,
        reference: "trf 001",
        key: "key-reorder-0001",
    });

    assert.equal(replayed, false);
    assert.equal(transaction.occurredAt.getTime(), between.getTime());
    assert.equal(transaction.occurredAtSource, "PAYMENT");
    assert.equal(transaction.externalReference, "TRF 001");
    assert.ok(transaction.createdAt > transaction.occurredAt, "registration stays its own timestamp");

    const rows = await prisma.walletTransaction.findMany({
        where: { wallet: { companyId } },
        orderBy: [{ occurredAt: "asc" }, { occurredSequence: "asc" }, { id: "asc" }],
    });
    assert.deepEqual(rows.map((row) => [row.type, row.balanceAfter]), [
        ["CONSUMPTION", -100_000],
        ["RECHARGE", 200_000],
        ["CONSUMPTION", 150_000],
    ]);
    const stored = await prisma.wallet.findUniqueOrThrow({ where: { companyId } });
    assert.equal(stored.balance, 150_000);
    assert.deepEqual(await ledgerFindings(), []);
});

test("the same Idempotency-Key returns the same top-up; with other data it is a conflict", async () => {
    const occurredAt = new Date(Date.now() - 60_000);
    const first = await manual({ amount: 80_000, occurredAt, reference: "TRF-002", key: "key-idem-0002" });
    const again = await manual({ amount: 80_000, occurredAt, reference: " trf-002 ", key: "key-idem-0002" });

    assert.equal(again.replayed, true);
    assert.equal(again.transaction.id, first.transaction.id);
    await rejectsWith(manual({ amount: 90_000, occurredAt, reference: "TRF-002", key: "key-idem-0002" }), 409);
    assert.equal(await prisma.walletTransaction.count({ where: { type: "RECHARGE" } }), 1);
    assert.equal((await prisma.wallet.findUniqueOrThrow({ where: { companyId } })).balance, 80_000);
});

test("one bank transfer credits a wallet once, even under another key", async () => {
    const occurredAt = new Date(Date.now() - 60_000);
    await manual({ amount: 50_000, occurredAt, reference: "TRF-003", key: "key-ref-0003-a" });

    await rejectsWith(manual({ amount: 50_000, occurredAt, reference: "trf-003", key: "key-ref-0003-b" }), 409);
    // The same reference in another company's wallet is a different transfer.
    await manual({ amount: 50_000, occurredAt, reference: "TRF-003", key: "key-ref-0003-c", company: otherCompanyId });
    assert.equal(await prisma.walletTransaction.count({ where: { type: "RECHARGE" } }), 2);
});

test("amounts, payment times and references are validated before any write", async () => {
    const past = new Date(Date.now() - 60_000);
    await rejectsWith(manual({ amount: 0, occurredAt: past, reference: "TRF-004", key: "key-val-0004-a" }), 400);
    await rejectsWith(manual({ amount: 10, occurredAt: new Date(Date.now() + 3_600_000), reference: "TRF-004", key: "key-val-0004-b" }), 400);
    await rejectsWith(manual({ amount: Number.NaN, occurredAt: past, reference: "TRF-004", key: "key-val-0004-c" }), 400);
    await rejectsWith(manual({ amount: 10, occurredAt: past, reference: "   ", key: "key-val-0004-d" }), 400);
    assert.equal(await prisma.walletTransaction.count(), 0);
});

test("a top-up dated inside an issued statement period is rejected, not re-dated", async () => {
    await wallet.debit({ companyId, amount: 10_000, currency: "COP" });
    await sleep(20);
    const cut = new Date();
    const record = await prisma.wallet.findUniqueOrThrow({ where: { companyId } });
    await prisma.accountStatement.create({
        data: {
            statementNumber: "EC-2026-999001",
            sequenceYear: 2026,
            sequenceNumber: 999_001,
            companyId,
            walletId: record.id,
            issuedById: actorId,
            currency: "COP",
            periodStart: record.createdAt,
            periodEnd: cut,
            openingBalance: 0,
            consumptions: 10_000,
            recharges: 0,
            refunds: 0,
            adjustments: 0,
            closingBalance: -10_000,
            totalPending: 10_000,
            creditBalance: 0,
            issuerSnapshot: {},
            customerSnapshot: {},
            previewFingerprint: "test",
        },
    });
    await sleep(20);

    await rejectsWith(
        manual({ amount: 10_000, occurredAt: new Date(cut.getTime() - 5), reference: "TRF-005", key: "key-closed-0005-a" }),
        409,
        "PERIOD_CLOSED",
    );
    const open = await manual({ amount: 10_000, occurredAt: new Date(), reference: "TRF-005", key: "key-closed-0005-b" });
    assert.ok(open.transaction.occurredAt > cut);
});

test("a wallet whose balance its movements do not explain is not silently re-balanced", async () => {
    await prisma.wallet.update({ where: { companyId }, data: { balance: -350_000 } });

    await rejectsWith(
        manual({ amount: 50_000, occurredAt: new Date(Date.now() - 60_000), reference: "TRF-DRIFT", key: "key-drift-0001" }),
        409,
        "LEDGER_DRIFT",
    );
    assert.equal((await prisma.wallet.findUniqueOrThrow({ where: { companyId } })).balance, -350_000);
    assert.equal(await prisma.walletTransaction.count(), 0);
});

test("concurrent top-ups and a debit leave one consistent ledger", async () => {
    const base = Date.now() - 120_000;
    await Promise.all([
        ...[1, 2, 3].map((n) => manual({
            amount: 10_000 * n,
            occurredAt: new Date(base + n * 1_000),
            reference: `TRF-CONC-${n}`,
            key: `key-conc-000${n}`,
        })),
        wallet.debit({ companyId, amount: 5_000, currency: "COP" }),
    ]);
    const stored = await prisma.wallet.findUniqueOrThrow({ where: { companyId } });
    assert.equal(stored.balance, 55_000);
    assert.deepEqual(await ledgerFindings(), []);
});

test("a Bre-B credit takes DevDiem's confirmation time, once, and is acknowledged", async () => {
    const creditedAt = new Date(Date.now() - 90_000).toISOString();
    const topUp = {
        id: "6f0f2d4e-1111-4c4c-9999-000000000001",
        status: "succeeded",
        state: "credited" as const,
        amount: "120000.00",
        bonus_amount: "0.00",
        currency: "COP",
        method_type: "BRE_B_MANUAL",
        action: null,
        expires_at: creditedAt,
        succeeded_at: creditedAt,
        credited_at: creditedAt,
        partner_acknowledged_at: null,
    };

    const entry = await gateway.creditTopUp(companyId, topUp);
    const repeat = await gateway.creditTopUp(companyId, topUp);

    assert.equal(entry?.id, repeat?.id);
    assert.equal(entry?.occurredAt.toISOString(), creditedAt);
    assert.equal(entry?.occurredAtSource, "GATEWAY_CONFIRMATION");
    assert.equal(await prisma.walletTransaction.count({ where: { gatewayTransactionId: topUp.id } }), 1);
    assert.deepEqual(acknowledged, [topUp.id, topUp.id]);
});

test("a credited top-up without confirmation time is not credited with the current time", async () => {
    await assert.rejects(gateway.creditTopUp(companyId, {
        id: "6f0f2d4e-1111-4c4c-9999-000000000002",
        status: "succeeded",
        state: "credited",
        amount: "10000.00",
        bonus_amount: "0.00",
        currency: "COP",
        method_type: "BRE_B_MANUAL",
        action: null,
        expires_at: new Date().toISOString(),
        succeeded_at: null,
        credited_at: null,
    }), /credited_at/);
    assert.equal(await prisma.walletTransaction.count(), 0);
    assert.deepEqual(acknowledged, []);
});

test("movements are scoped to the company, sorted and filtered by effective time", async () => {
    const early = new Date(Date.now() - 3_600_000);
    await wallet.debit({ companyId, amount: 1_000, currency: "COP" });
    await manual({ amount: 9_000, occurredAt: early, reference: "TRF-LIST-1", key: "key-list-0001" });
    await manual({ amount: 7_000, occurredAt: early, reference: "TRF-LIST-OTHER", key: "key-list-0002", company: otherCompanyId });

    const all = await wallet.getWalletForCompany(companyId);
    assert.deepEqual(all.transactions.map((row) => row.type), ["CONSUMPTION", "RECHARGE"]);
    assert.ok(all.transactions.every((row) => row.walletId === all.wallet.id));
    assert.equal(all.transactions[1].effectiveTimeLabel, "Hora del pago");

    const recharges = await wallet.getWalletForCompany(companyId, { type: "RECHARGE" });
    assert.deepEqual(recharges.transactions.map((row) => row.externalReference), ["TRF-LIST-1"]);

    const window = await wallet.getWalletForCompany(companyId, {
        from: new Date(early.getTime() - 1_000),
        to: new Date(early.getTime() + 1_000),
    });
    assert.deepEqual(window.transactions.map((row) => row.type), ["RECHARGE"]);
    assert.equal(window.pagination.total, 1);
});

test("only the platform may read another company's wallet movements", () => {
    const actor = (role: string, company: string | null = companyId) =>
        ({ id: "u", role, companyId: company, email: "u@test.local", name: "U" }) as never;
    assert.equal(defineAbilitiesFor(actor("SUPER_ADMIN", null)).can("manage", "Wallet"), true);
    assert.equal(defineAbilitiesFor(actor("SYSTEM_ADMIN", null)).can("manage", "Wallet"), true);
    for (const role of ["OWNER", "GENERAL_ADMIN", "ADMIN", "OPERATOR"]) {
        assert.equal(defineAbilitiesFor(actor(role)).can("manage", "Wallet"), false, role);
    }
});

function remoteTopUp(id: string, state: string, creditedAt: string | null) {
    const topUp = {
        id,
        status: "succeeded",
        state,
        amount: "90000.00",
        bonus_amount: "0.00",
        currency: "COP",
        method_type: "BRE_B_MANUAL",
        action: null,
        expires_at: new Date(Date.now() + 3_600_000).toISOString(),
        succeeded_at: creditedAt,
        credited_at: creditedAt,
        partner_acknowledged_at: null,
    };
    remoteTopUps.set(id, topUp);
    return topUp;
}

function stateEvent(topUpId: string, state: string, accountCode = `diem-sas:${companyId}`) {
    const event = gateway.parseTopUpStateWebhook({
        event_id: `topup:${topUpId}:${state}`,
        type: "topup.state_changed",
        topup_id: topUpId,
        account_code: accountCode,
        state,
        occurred_at: new Date().toISOString(),
    });
    assert.ok(event);
    return event;
}

test("a credited-top-up webhook credits the wallet at once, once, from DevDiem's own record", async () => {
    const id = "6f0f2d4e-2222-4c4c-9999-000000000001";
    const creditedAt = new Date(Date.now() - 30_000).toISOString();
    remoteTopUp(id, "credited", creditedAt);

    const first = await gateway.handleTopUpStateWebhook(stateEvent(id, "credited"));
    const replay = await gateway.handleTopUpStateWebhook(stateEvent(id, "credited"));

    assert.deepEqual(first, { ok: true, state: "credited" });
    assert.deepEqual(replay, { ok: true, state: "credited" });
    const credits = await prisma.walletTransaction.findMany({ where: { gatewayTransactionId: id } });
    assert.equal(credits.length, 1);
    assert.equal(credits[0].occurredAt.toISOString(), creditedAt);
    assert.equal((await prisma.wallet.findUniqueOrThrow({ where: { companyId } })).balance, 90_000);
    assert.ok(acknowledged.includes(id));
});

test("the webhook is only a hint: nothing is credited unless DevDiem reports the top-up credited", async () => {
    const id = "6f0f2d4e-2222-4c4c-9999-000000000002";
    remoteTopUp(id, "under_review", null);

    const result = await gateway.handleTopUpStateWebhook(stateEvent(id, "credited"));

    assert.deepEqual(result, { ok: true, state: "under_review" });
    assert.equal(await prisma.walletTransaction.count(), 0);
});

test("webhooks for unknown accounts or malformed payloads are rejected", async () => {
    assert.deepEqual(
        await gateway.handleTopUpStateWebhook(stateEvent("x", "credited", "otro-partner:abc")),
        { ok: false, reason: "unknown_account" },
    );
    assert.deepEqual(
        await gateway.handleTopUpStateWebhook(stateEvent("x", "credited", "diem-sas:no-existe")),
        { ok: false, reason: "unknown_company" },
    );
    assert.equal(gateway.parseTopUpStateWebhook({ type: "topup.state_changed", topup_id: 1 }), null);
    assert.equal(gateway.parseTopUpStateWebhook(null), null);
});
