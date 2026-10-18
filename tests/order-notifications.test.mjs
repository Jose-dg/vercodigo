import assert from "node:assert/strict";
import test from "node:test";

import {
    buildOrderNotifications,
    notificationExternalRef,
    parseNotificationExternalRef,
    parseTeamEmails,
} from "../src/modules/notifications/domain.ts";

const buyer = { key: "u-buyer", email: "ana@empresa.co", name: "Ana", role: "buyer" };
const owner = { key: "u-owner", email: "dueno@empresa.co", name: "Dueño", role: "company_admin" };
const team = parseTeamEmails("ops@diem.co, Ops@diem.co\nfinanzas@diem.co, no-es-correo");

const facts = (overrides = {}) => ({
    aggregateType: "CodePurchase",
    id: "cmp123456",
    status: "AWAITING_STOCK",
    created: true,
    orderNumber: "#123456",
    itemSummary: "5 × PlayStation US$10",
    total: "$158.500",
    companyName: "Virtual Zone",
    buyerName: "Ana",
    orderUrl: "https://www.vercode.me/codes/purchases/cmp123456",
    internalReason: null,
    ...overrides,
});

const summary = (list) => list.map((n) => `${n.template}→${n.recipient.email}`).sort();

test("una orden creada en espera avisa al comprador (recibido) y al dueño y al equipo (nuevo pedido)", () => {
    const list = buildOrderNotifications({ facts: facts(), buyer, companyAdmins: [owner], team });
    assert.deepEqual(summary(list), [
        "order_received_admin→dueno@empresa.co",
        "order_received_admin→finanzas@diem.co",
        "order_received_admin→ops@diem.co",
        "order_received→ana@empresa.co",
    ]);
});

test("si nace lista, el comprador recibe un solo correo: pedido listo", () => {
    const list = buildOrderNotifications({ facts: facts({ status: "COMPLETED" }), buyer, companyAdmins: [owner], team });
    const toBuyer = list.filter((n) => n.recipient.email === buyer.email).map((n) => n.template);
    assert.deepEqual(toBuyer, ["order_ready"]);
});

test("al completarse después, solo el comprador recibe pedido listo", () => {
    const list = buildOrderNotifications({ facts: facts({ status: "COMPLETED", created: false }), buyer, companyAdmins: [owner], team });
    assert.deepEqual(summary(list), ["order_ready→ana@empresa.co"]);
});

test("en atención, el comprador recibe un motivo genérico y el equipo el detalle técnico", () => {
    const list = buildOrderNotifications({
        facts: facts({ status: "ACTION_REQUIRED", created: false, internalReason: "Diem 409 contract" }),
        buyer, companyAdmins: [owner], team,
    });
    const toBuyer = list.find((n) => n.recipient.email === buyer.email);
    assert.equal(toBuyer.template, "order_action_required");
    assert.doesNotMatch(toBuyer.params.reason, /409/);
    const toTeam = list.filter((n) => n.template === "order_action_required_admin");
    assert.equal(toTeam.length, 2);
    assert.match(toTeam[0].params.reason, /409/);
});

test("el comprador no recibe el aviso de admin aunque también sea dueño", () => {
    const list = buildOrderNotifications({ facts: facts(), buyer, companyAdmins: [owner, { ...buyer, key: "u-buyer", role: "company_admin" }], team: [] });
    assert.deepEqual(summary(list), ["order_received_admin→dueno@empresa.co", "order_received→ana@empresa.co"]);
});

test("una orden abierta que no se acaba de crear no genera avisos", () => {
    assert.deepEqual(buildOrderNotifications({ facts: facts({ created: false }), buyer, companyAdmins: [owner], team }), []);
});

test("el external_ref identifica aviso, orden y destinatario, y se puede leer de vuelta", () => {
    const ref = notificationExternalRef("order_ready", "CodePurchase", "cmp123456", "team:ops@diem.co");
    assert.equal(ref, "sas:order_ready:CodePurchase:cmp123456:team:ops@diem.co");
    assert.deepEqual(parseNotificationExternalRef(ref), {
        template: "order_ready", aggregateType: "CodePurchase", id: "cmp123456", recipientKey: "team:ops@diem.co",
    });
    assert.equal(parseNotificationExternalRef("otra:cosa"), null);
});

test("los correos del equipo se normalizan, deduplican y validan", () => {
    assert.deepEqual(team.map((r) => r.email), ["ops@diem.co", "finanzas@diem.co"]);
});
