import assert from "node:assert/strict";
import test from "node:test";

import {
    apiKeyMatches,
    apiKeyPrefixOf,
    bearerToken,
    generateApiKey,
    hashApiKey,
    normalizeScopes,
} from "../src/modules/api-keys/domain.ts";
import { serializeCatalog, serializeDelivery } from "../src/modules/api-v1/serializers.ts";

const PEPPER = "p".repeat(32);

test("a generated key has the public prefix and a 32-byte secret", () => {
    const { key, prefix } = generateApiKey();
    assert.match(key, /^vck_live_[0-9a-f]{12}_[A-Za-z0-9_-]{43}$/);
    assert.equal(apiKeyPrefixOf(key), prefix);
    assert.notEqual(generateApiKey().key, key);
});

test("only the exact key matches its peppered hash", () => {
    const { key } = generateApiKey();
    const stored = hashApiKey(key, PEPPER);
    assert.equal(apiKeyMatches(key, stored, PEPPER), true);
    assert.equal(apiKeyMatches(`${key.slice(0, -1)}${key.endsWith("A") ? "B" : "A"}`, stored, PEPPER), false);
    assert.equal(apiKeyMatches(key, stored, "q".repeat(32)), false);
    assert.equal(apiKeyMatches(key, "abc", PEPPER), false);
    assert.throws(() => hashApiKey(key, "short"));
});

test("malformed keys and headers are rejected before any lookup", () => {
    assert.equal(apiKeyPrefixOf("ddk_live_abc_def"), null);
    assert.equal(apiKeyPrefixOf("vck_live_ABCDEF123456_x"), null);
    assert.equal(bearerToken("Bearer vck_live_x"), "vck_live_x");
    assert.equal(bearerToken("Basic abc"), null);
    assert.equal(bearerToken(null), null);
});

test("scopes are limited to the known list, in canonical order", () => {
    assert.deepEqual(normalizeScopes(["wallet:read", "admin:all", "catalog:read"]), ["catalog:read", "wallet:read"]);
    assert.deepEqual(normalizeScopes("catalog:read"), []);
});

test("a delivery never exposes its codes", () => {
    const delivery = serializeDelivery({
        id: "p1",
        status: "COMPLETED",
        productId: "prod",
        productName: "Netflix",
        denominationId: "d1",
        count: 1,
        totalAmount: 20,
        currency: "USD",
        fulfillmentStatus: "delivered",
        deliveredCodes: ["SECRET-PIN"],
        keys: [{ code: "SECRET-PIN" }],
        diemRequestSnapshot: {
            body: {
                delivery_mode: "managed_and_partner",
                recipient: { first_name: "Luis", last_name: "Gómez", email: "luis@cliente.co" },
            },
        },
        createdAt: new Date("2026-10-22T10:00:00Z"),
        completedAt: null,
    });
    assert.doesNotMatch(JSON.stringify(delivery), /SECRET-PIN/);
    assert.equal(delivery.status, "completed");
    assert.equal(delivery.email_delivery, "sent");
    assert.deepEqual(delivery.recipient, { first_name: "Luis", last_name: "Gómez", email: "luis@cliente.co" });
});

test("the catalog lists each priced denomination with its face value", () => {
    const rows = serializeCatalog(
        [{
            id: "prod",
            name: "Netflix",
            brand: "Netflix",
            category: null,
            denominations: [{ id: "d1", amount: 20, currency: "USD", countryRegion: "US" }],
        }],
        [
            { productId: "prod", denominationId: "d1", nominalAmount: 20, salePrice: 85000, currency: "COP" },
            { productId: "missing", denominationId: null, nominalAmount: null, salePrice: 1, currency: "COP" },
        ],
    );
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0].face_value, { amount: 20, currency: "USD" });
    assert.deepEqual(rows[0].unit_price, { amount: 85000, currency: "COP" });
});
