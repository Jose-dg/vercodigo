import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
    activationScope,
    laneFulfillmentOrders,
    serializeActivationOrder,
} from "../src/lib/codes/fulfillment-order.ts";

const card = {
    uuid: "TKGU6TT9",
    productName: "Roblox",
    customAmount: null,
    denomination: { amount: 10, currency: "USD" },
    keyCode: null,
};

const job = (overrides = {}) => ({
    status: "AWAITING_STOCK",
    fulfillmentStatus: "awaiting_stock",
    lastError: null,
    deliveredCodes: null,
    commercialAmount: 37000,
    commercialCurrency: "COP",
    createdAt: new Date("2026-10-10T22:55:19Z"),
    ...overrides,
});

const activation = {
    activatedAt: new Date("2026-10-10T23:30:00Z"),
    commercialAmount: 37000,
    commercialCurrency: "COP",
    activationAmount: 10,
};

test("una activación esperando stock es una solicitud pendiente de la tabla", () => {
    const row = serializeActivationOrder({ card, job: job(), activation: null, requesterLabel: "Operador" });
    assert.equal(row.kind, "activation");
    assert.equal(row.detailHref, "/codes/activations/TKGU6TT9");
    assert.equal(row.status, "AWAITING_STOCK");
    assert.equal(row.isPending, true);
    assert.equal(row.totalAmount, 37000);
    assert.equal(row.currency, "COP");
    assert.deepEqual(row.keys, []);
});

test("una activación cobrada es entregada, con el código y la fecha de activación", () => {
    const row = serializeActivationOrder({
        card,
        job: job({ status: "COMPLETED", fulfillmentStatus: "delivered", deliveredCodes: ["ROBLOX-1"] }),
        activation,
    });
    assert.equal(row.status, "COMPLETED");
    assert.equal(row.isSuccessful, true);
    assert.deepEqual(row.keys, [{ code: "ROBLOX-1" }]);
    assert.deepEqual(row.completedAt, activation.activatedAt);
    assert.equal(row.hasDeliveryCountMismatch, false);
});

test("una activación sin job (WhatsApp) se muestra entregada con el código de la tarjeta", () => {
    const row = serializeActivationOrder({ card: { ...card, keyCode: "KEY-9" }, job: null, activation });
    assert.equal(row.status, "COMPLETED");
    assert.deepEqual(row.keys, [{ code: "KEY-9" }]);
    assert.deepEqual(row.createdAt, activation.activatedAt);
});

test("un job COMPLETED sin CardActivation no se reporta como entregado", () => {
    const row = serializeActivationOrder({
        card,
        job: job({ status: "COMPLETED", deliveredCodes: ["ROBLOX-1"] }),
        activation: null,
    });
    assert.equal(row.status, "ACTION_REQUIRED");
    assert.equal(row.needsAction, true);
    assert.match(row.lastError, /no quedó registrada ni cobrada/);
});

test("compras y activaciones comparten carriles, orden y límite", () => {
    const purchase = (id, at, status) => ({
        id, occurredAt: new Date(at), status,
        isPending: status === "PENDING", isSuccessful: status === "COMPLETED", needsAction: false,
    });
    const activationRow = serializeActivationOrder({ card, job: job(), activation: null });
    const lanes = laneFulfillmentOrders([
        purchase("p-old", "2026-10-01T00:00:00Z", "COMPLETED"),
        activationRow,
        purchase("p-new", "2026-10-11T00:00:00Z", "PENDING"),
    ], 2);
    assert.deepEqual(lanes.pending.map((row) => row.id), ["p-new", "activation:TKGU6TT9"]);
    assert.deepEqual(lanes.completed, []);
});

test("la visibilidad de activaciones sigue la misma regla que la de compras", () => {
    const actor = (role, extra = {}) => ({ id: "u1", role, companyId: "c1", storeId: "s1", ...extra });
    assert.deepEqual(activationScope(actor("OPERATOR")), { kind: "card", card: { storeId: "s1" } });
    assert.deepEqual(activationScope(actor("ADMIN", { storeId: null })), { kind: "none" });
    assert.deepEqual(activationScope(actor("OWNER")), { kind: "card", card: { store: { companyId: "c1" } } });
    assert.deepEqual(activationScope(actor("SUPER_ADMIN"), "c9"), { kind: "card", card: { store: { companyId: "c9" } } });
    assert.deepEqual(activationScope(actor("SUPER_ADMIN")), { kind: "card", card: {} });
    assert.deepEqual(activationScope(actor("CUSTOMER")), { kind: "user", userId: "u1" });
});

test("'Mis solicitudes' lista activaciones además de compras", async () => {
    const route = await readFile(new URL("../src/app/api/codes/purchases/route.ts", import.meta.url), "utf8");
    assert.match(route, /listFulfillmentOrdersForUser/);
    assert.doesNotMatch(route, /listCodePurchasesForUser/);
});
