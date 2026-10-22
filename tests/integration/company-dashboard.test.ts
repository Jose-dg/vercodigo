/**
 * Company home figures against a ledger fixture: money from wallet movements
 * (net of refunds), Colombian days, services, top products and recent orders.
 *
 *   TEST_DATABASE_URL=postgresql://<user>@localhost:5432/diemsas_concurrency_test \
 *     npm run test:concurrency
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
if (!testDatabaseUrl) throw new Error("TEST_DATABASE_URL es obligatoria");
if (!["localhost", "127.0.0.1", "::1"].includes(new URL(testDatabaseUrl).hostname)) {
    throw new Error("TEST_DATABASE_URL debe apuntar a una base local desechable");
}
process.env.DATABASE_URL = testDatabaseUrl;

let prisma: typeof import("@/lib/prisma").default;
let getCompanyDashboard: typeof import("@/services/company/dashboard.service").getCompanyDashboard;
let resolveRange: typeof import("@/lib/dashboard/range").resolveRange;
let companyId = "";

// 21 Oct 2026, 21:00 in Bogotá.
const NOW = new Date("2026-10-22T02:00:00Z");

before(async () => {
    prisma = (await import("@/lib/prisma")).default;
    ({ getCompanyDashboard } = await import("@/services/company/dashboard.service"));
    ({ resolveRange } = await import("@/lib/dashboard/range"));
});

after(async () => {
    await prisma.$disconnect();
});

beforeEach(async () => {
    await prisma.apiRateWindow.deleteMany();
    await prisma.sandboxDelivery.deleteMany();
    await prisma.companyApiKey.deleteMany();
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
    await prisma.productDenomination.deleteMany();
    await prisma.product.deleteMany();
    await prisma.user.deleteMany();
    await prisma.store.deleteMany();
    await prisma.company.deleteMany();

    const suffix = Math.random().toString(36).slice(2);
    const company = await prisma.company.create({ data: { name: "Dash SAS", taxId: `NIT-${suffix}`, email: "d@test.local", phone: "1" } });
    companyId = company.id;
    const store = await prisma.store.create({ data: { name: "Sede", code: `ST-${suffix}`, address: "x", phone: "1", companyId } });
    const user = await prisma.user.create({ data: { email: `o-${suffix}@test.local`, name: "Owner", role: "OWNER", companyId, storeId: store.id } });
    const psn = await prisma.product.create({ data: { name: "PlayStation", sku: `PSN-${suffix}`, brand: "PlayStation" } });
    const steam = await prisma.product.create({ data: { name: "Steam Wallet", sku: `STM-${suffix}`, brand: "Steam" } });
    const psn100 = await prisma.productDenomination.create({ data: { productId: psn.id, amount: 100, currency: "USD", countryRegion: "US" } });
    const wallet = await prisma.wallet.create({ data: { companyId, currency: "COP", balance: 41000 } });

    const purchase = (productId: string, denominationId: string | null, at: string, status: string, total: number, api = false) =>
        prisma.codePurchase.create({
            data: {
                companyId, storeId: store.id, userId: user.id, productId, denominationId, count: 1,
                totalAmount: total, currency: "COP", status, idempotencyKey: `k-${Math.random()}`, occurredAt: new Date(at),
                diemRequestSnapshot: api ? { idempotencyKey: "x", correlationId: "y", body: { metadata: { channel: "api" } } } : undefined,
            },
        });
    const movement = (type: "RECHARGE" | "CONSUMPTION" | "REFUND", amount: number, at: string, link: Record<string, string> = {}) =>
        prisma.walletTransaction.create({
            data: { walletId: wallet.id, type, amount, status: "CONFIRMED", occurredAt: new Date(at), occurredAtSource: "LEDGER_EVENT", ...link },
        });

    await movement("RECHARGE", 500000, "2026-09-01T15:00:00Z");
    // 20 Oct (Bogotá) — 02:00 UTC on the 21st is still the 20th in Colombia.
    const p1 = await purchase(psn.id, psn100.id, "2026-10-21T02:00:00Z", "COMPLETED", 180000);
    await movement("CONSUMPTION", 180000, "2026-10-21T02:00:00Z", { codePurchaseId: p1.id });
    const p2 = await purchase(psn.id, psn100.id, "2026-10-21T15:00:00Z", "COMPLETED", 180000, true);
    const c2 = await movement("CONSUMPTION", 180000, "2026-10-21T15:00:00Z", { codePurchaseId: p2.id });
    // p2 refunded the same day: it nets to zero.
    await movement("REFUND", 180000, "2026-10-21T16:00:00Z", { reversalOfId: c2.id });
    const p3 = await purchase(steam.id, null, "2026-10-21T17:00:00Z", "COMPLETED", 60000);
    await movement("CONSUMPTION", 60000, "2026-10-21T17:00:00Z", { codePurchaseId: p3.id });
    await purchase(steam.id, null, "2026-10-21T18:00:00Z", "AWAITING_STOCK", 60000);
    // An old purchase outside the 7-day window.
    const p5 = await purchase(steam.id, null, "2026-08-01T15:00:00Z", "COMPLETED", 50000);
    await movement("CONSUMPTION", 50000, "2026-08-01T15:00:00Z", { codePurchaseId: p5.id });
    // A QR activation.
    const card = await prisma.card.create({ data: { uuid: `C${suffix}`.slice(0, 8).toUpperCase(), qrData: "x", productId: steam.id, storeId: store.id } });
    const activation = await prisma.cardActivation.create({
        data: { cardId: card.id, storeId: store.id, activatedBy: user.id, activationAmount: 40000, activatedAt: new Date("2026-10-21T19:00:00Z") },
    });
    await movement("CONSUMPTION", 40000, "2026-10-21T19:00:00Z", { cardActivationId: activation.id });
});

test("KPIs are all-time and net of refunds", async () => {
    const dashboard = await getCompanyDashboard(companyId, resolveRange({ range: "7d", now: NOW }));
    assert.deepEqual(dashboard.kpis, {
        balance: 41000,
        orders: 6,
        completedOrders: 5,
        totalSpent: 180000 + 60000 + 50000 + 40000,
        deposited: 500000,
    });
});

test("the 7-day statistics group money by Colombian day, service and product", async () => {
    const { stats } = await getCompanyDashboard(companyId, resolveRange({ range: "7d", now: NOW }));
    assert.equal(stats.spent, 280000);
    assert.equal(stats.orders, 5);
    assert.equal(stats.completedOrders, 4);
    assert.equal(stats.bucket, "day");
    assert.equal(stats.series.length, 7);
    assert.deepEqual(stats.series.find((point) => point.key === "2026-10-20"), { key: "2026-10-20", amount: 180000 });
    assert.deepEqual(stats.series.find((point) => point.key === "2026-10-21"), { key: "2026-10-21", amount: 100000 });
    assert.deepEqual(stats.byService.map((row) => [row.service, row.amount]), [["codes", 240000], ["activations", 40000]]);
    assert.deepEqual(stats.topProducts.map((row) => [row.name, row.region, row.amount]), [
        ["PlayStation", "US", 180000],
        ["Steam Wallet", null, 100000],
    ]);
});

test("all time spans the history by month; recent orders show channel and status", async () => {
    const dashboard = await getCompanyDashboard(companyId, resolveRange({ range: "all", now: NOW }));
    assert.equal(dashboard.stats.firstDay, "2026-08-01");
    assert.equal(dashboard.stats.spent, 330000);
    const recent = dashboard.recentOrders;
    assert.equal(recent[0].kind, "activation");
    assert.equal(recent[0].channel, "qr");
    assert.equal(recent.find((order) => order.status === "awaiting_stock")?.productName, "Steam Wallet");
    assert.ok(recent.some((order) => order.channel === "api"));
});
