import test from "node:test";
import assert from "node:assert/strict";

import {
    normalizePurchaseOriginPhone,
    resolvePurchaseOrigin,
} from "../src/services/purchases/purchase-origin.ts";

const companies = new Set(["company-a", "company-b"]);
const stores = [
    { id: "store-a", companyId: "company-a", isActive: true, name: "Sede A" },
    { id: "store-b", companyId: "company-b", isActive: true, name: "Sede B" },
];
const phones = [
    { id: "phone-a", companyId: "company-a", isActive: true, label: "Edwin" },
    { id: "phone-b", companyId: "company-b", isActive: true, label: "Otro" },
];

const db = {
    company: {
        findUnique: async ({ where }) => companies.has(where.id) ? { id: where.id } : null,
    },
    store: {
        findFirst: async ({ where }) => stores.find((row) =>
            row.id === where.id && row.companyId === where.companyId && row.isActive === where.isActive
        ) ?? null,
    },
    purchaseOriginPhone: {
        findFirst: async ({ where }) => phones.find((row) =>
            row.id === where.id && row.companyId === where.companyId && row.isActive === where.isActive
        ) ?? null,
    },
};

const actor = (overrides = {}) => ({
    id: "user-a",
    role: "GENERAL_ADMIN",
    companyId: "company-a",
    storeId: null,
    purchaseOriginPhoneId: null,
    ...overrides,
});

test("origin phones are normalized without hardcoding labels or formatting", () => {
    assert.equal(normalizePurchaseOriginPhone("300 3702892"), "3003702892");
    assert.equal(normalizePurchaseOriginPhone("+57 312 264 0682"), "3122640682");
    assert.throws(() => normalizePurchaseOriginPhone("601 234 5678"), /celular colombiano válido/);
});

test("a business profile uses its configured phone before its store", async () => {
    const result = await resolvePurchaseOrigin({
        actor: actor({ storeId: "store-a", purchaseOriginPhoneId: "phone-a" }),
        db,
    });
    assert.deepEqual(result, {
        companyId: "company-a",
        storeId: null,
        purchaseOriginPhoneId: "phone-a",
        labelSnapshot: "Edwin",
    });
});

test("a business profile falls back to its store and may remain unattributed", async () => {
    const fromStore = await resolvePurchaseOrigin({ actor: actor({ storeId: "store-a" }), db });
    assert.equal(fromStore.storeId, "store-a");
    assert.equal(fromStore.purchaseOriginPhoneId, null);

    const unattributed = await resolvePurchaseOrigin({ actor: actor(), db });
    assert.equal(unattributed.companyId, "company-a");
    assert.equal(unattributed.storeId, null);
    assert.equal(unattributed.purchaseOriginPhoneId, null);
});

test("platform requires exactly one explicit origin", async () => {
    const platform = actor({ role: "SYSTEM_ADMIN", companyId: null });
    await assert.rejects(
        resolvePurchaseOrigin({ actor: platform, targetCompanyId: "company-a", db }),
        /Selecciona una sede o un número de origen/,
    );
    await assert.rejects(
        resolvePurchaseOrigin({
            actor: platform,
            targetCompanyId: "company-a",
            requestedOrigin: { kind: "phone", id: "phone-a" },
            legacyStoreId: "store-a",
            db,
        }),
        /no ambos/,
    );
});

test("origins from another company are rejected", async () => {
    const platform = actor({ role: "SYSTEM_ADMIN", companyId: null });
    await assert.rejects(
        resolvePurchaseOrigin({
            actor: platform,
            targetCompanyId: "company-a",
            requestedOrigin: { kind: "phone", id: "phone-b" },
            db,
        }),
        /no pertenece a la compañía/,
    );
    await assert.rejects(
        resolvePurchaseOrigin({
            actor: platform,
            targetCompanyId: "company-a",
            requestedOrigin: { kind: "store", id: "store-b" },
            db,
        }),
        /no pertenece a la compañía/,
    );
});

test("a business profile cannot override its configured origin", async () => {
    await assert.rejects(
        resolvePurchaseOrigin({
            actor: actor({ purchaseOriginPhoneId: "phone-a" }),
            requestedOrigin: { kind: "store", id: "store-a" },
            db,
        }),
        /no puede reemplazar/,
    );
});
