import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
    OPEN_CODE_PURCHASE_STATUSES,
    canTransitionCodePurchase,
    updateOpenCodePurchase,
} from "../src/services/self-service/code-purchase-state.ts";

const schemaPath = fileURLToPath(new URL("../prisma/schema.prisma", import.meta.url));
const repairPath = fileURLToPath(new URL(
    "../scripts/repair-duplicate-wallet-consumptions.ts",
    import.meta.url,
));

// Minimal in-memory stand-in for Prisma's updateMany compare-and-set.
function fakeDb(status) {
    const row = { id: "purchase-1", status };
    return {
        row,
        codePurchase: {
            async updateMany({ where, data }) {
                if (where.id !== row.id || !where.status.in.includes(row.status)) return { count: 0 };
                Object.assign(row, data);
                return { count: 1 };
            },
        },
    };
}

test("settled purchases are absorbing", () => {
    for (const settled of ["COMPLETED", "FAILED"]) {
        for (const target of [...OPEN_CODE_PURCHASE_STATUSES, "COMPLETED", "FAILED"]) {
            assert.equal(canTransitionCodePurchase(settled, target), false, `${settled} → ${target}`);
        }
    }
});

test("open purchases move between open states and settle, never into FINALIZING", () => {
    assert.equal(canTransitionCodePurchase("PENDING", "AWAITING_STOCK"), true);
    assert.equal(canTransitionCodePurchase("ACTION_REQUIRED", "PENDING"), true);
    assert.equal(canTransitionCodePurchase("PENDING", "COMPLETED"), true);
    assert.equal(canTransitionCodePurchase("AWAITING_STOCK", "FAILED"), true);
    assert.equal(canTransitionCodePurchase("PENDING", "FINALIZING"), false);
    assert.equal(canTransitionCodePurchase("UNKNOWN", "PENDING"), false);
});

test("compare-and-set applies while open and is a no-op once settled", async () => {
    const open = fakeDb("PENDING");
    assert.equal(await updateOpenCodePurchase(open, "purchase-1", { status: "COMPLETED" }), true);
    assert.equal(open.row.status, "COMPLETED");

    // A late processor tries to reopen or fail the settled purchase.
    assert.equal(await updateOpenCodePurchase(open, "purchase-1", { status: "PENDING" }), false);
    assert.equal(await updateOpenCodePurchase(open, "purchase-1", { status: "FAILED" }), false);
    assert.equal(open.row.status, "COMPLETED");
});

test("FINALIZING is rejected as a transition target", async () => {
    await assert.rejects(
        updateOpenCodePurchase(fakeDb("PENDING"), "purchase-1", { status: "FINALIZING" }),
        /not a valid CodePurchase transition target/,
    );
});

test("the database schema enforces one wallet movement per code purchase", async () => {
    const schema = await readFile(schemaPath, "utf8");
    assert.match(schema, /codePurchaseId\s+String\?\s+@unique/);
});

test("duplicate repair uses Prisma ORM and never handwritten SQL", async () => {
    const source = await readFile(repairPath, "utf8");
    assert.doesNotMatch(source, /\$(?:queryRaw|queryRawUnsafe|executeRaw|executeRawUnsafe)|\bPrisma\.sql\b/);
    assert.match(source, /runSerializableTransaction\(prisma/);
    assert.match(source, /DUPLICATE_WALLET_CONSUMPTION_REPAIRED/);
});
