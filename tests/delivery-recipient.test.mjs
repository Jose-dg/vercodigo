import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import { buildCodeRequestCommand } from "../src/lib/devdiem/fulfillment.ts";
import {
    InvalidDeliveryRecipientError,
    deliveryRecipientOf,
    normalizeDeliveryRecipient,
    recipientDeliveryState,
    sameDeliveryRecipient,
} from "../src/lib/codes/delivery-recipient.ts";

beforeEach(() => {
    process.env.DIEM_API_URL = "https://diem.example.test/";
    process.env.DIEM_SERVICE_API_KEY = "ddk_test_secret";
    process.env.DIEM_STORE_ID = "11111111-1111-4111-8111-111111111111";
});

const params = (extra = {}) => ({
    idempotencyKey: "diem-sas-purchase:c1:k1",
    externalReference: "DIEM-SAS-PURCHASE-p1",
    source: "partner_api",
    productId: "22222222-2222-4222-8222-222222222222",
    quantity: 1,
    recipient: { firstName: "Ana", lastName: "Ruiz", email: "ana@cliente.co" },
    commercial: {
        accountCode: "diem-sas:c1",
        referenceNamespace: "code_purchase",
        currencyCode: "COP",
        unitPrice: 36000,
        totalAmount: 36000,
    },
    ...extra,
});

test("a recipient is normalized and invalid ones are rejected", () => {
    assert.deepEqual(
        normalizeDeliveryRecipient({ firstName: "  Ana  María ", lastName: " Ruiz", email: " Ana@Cliente.CO " }),
        { firstName: "Ana María", lastName: "Ruiz", email: "ana@cliente.co" },
    );
    assert.throws(() => normalizeDeliveryRecipient({ firstName: "", email: "a@b.co" }), InvalidDeliveryRecipientError);
    assert.throws(() => normalizeDeliveryRecipient({ firstName: "Ana", email: "ana@cliente" }), InvalidDeliveryRecipientError);
    assert.throws(() => normalizeDeliveryRecipient({ firstName: "Ana", email: "ana cliente@x.co" }), InvalidDeliveryRecipientError);
});

test("buyer-only purchases keep the exact partner_retrieval command", () => {
    const command = buildCodeRequestCommand(params());
    assert.equal(command.body.delivery_mode, "partner_retrieval");
    assert.equal(deliveryRecipientOf(command), null);
});

test("a customer delivery asks Diem to email the recipient and stays readable by the buyer", () => {
    const command = buildCodeRequestCommand(params({ deliveryMode: "managed_and_partner" }));
    assert.equal(command.body.delivery_mode, "managed_and_partner");
    assert.equal(command.body.preferred_channel, "email");
    const stored = JSON.parse(JSON.stringify(command));
    assert.deepEqual(deliveryRecipientOf(stored), { firstName: "Ana", lastName: "Ruiz", email: "ana@cliente.co" });
});

test("idempotency treats a different recipient as a different purchase", () => {
    const ana = { firstName: "Ana", lastName: "Ruiz", email: "ana@cliente.co" };
    assert.equal(sameDeliveryRecipient(null, null), true);
    assert.equal(sameDeliveryRecipient(ana, { ...ana }), true);
    assert.equal(sameDeliveryRecipient(ana, null), false);
    assert.equal(sameDeliveryRecipient(ana, { ...ana, email: "otra@cliente.co" }), false);
});

test("the email state comes from Diem's request status", () => {
    assert.equal(recipientDeliveryState("delivered"), "sent");
    assert.equal(recipientDeliveryState("delivery_pending"), "sending");
    assert.equal(recipientDeliveryState("allocated"), "sending");
    assert.equal(recipientDeliveryState("action_required"), "failed");
    assert.equal(recipientDeliveryState(null), null);
});
