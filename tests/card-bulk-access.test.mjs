import assert from "node:assert/strict";
import test from "node:test";

import {
    CARD_BULK_OPERATIONS,
    canRunCardBulkOperation,
    defineAbilitiesFor,
} from "../src/lib/auth/abilities.ts";

const ROLES = ["SUPER_ADMIN", "SYSTEM_ADMIN", "OWNER", "GENERAL_ADMIN", "ADMIN", "OPERATOR"];

function abilityFor(role) {
    return defineAbilitiesFor({ role, companyId: "company-1", storeId: "store-1" });
}

test("only SUPER_ADMIN can reassign or bulk-activate cards", () => {
    for (const operation of Object.keys(CARD_BULK_OPERATIONS)) {
        const allowed = ROLES.filter((role) => canRunCardBulkOperation(operation, role, abilityFor(role)));
        assert.deepEqual(allowed, ["SUPER_ADMIN"], operation);
    }
});

test("the menu check matches what the API route enforces", () => {
    // The route is withAuth(action, subject) plus a platform-role check; a role
    // that sees the link must pass both, and a role that does not see it must fail one.
    for (const [operation, [action, subject]] of Object.entries(CARD_BULK_OPERATIONS)) {
        for (const role of ROLES) {
            const passesApi = ["SUPER_ADMIN", "SYSTEM_ADMIN"].includes(role) && abilityFor(role).can(action, subject);
            assert.equal(canRunCardBulkOperation(operation, role, abilityFor(role)), passesApi, `${operation}/${role}`);
        }
    }
});

test("no role and no user never qualify", () => {
    assert.equal(canRunCardBulkOperation("activate", undefined, abilityFor("SUPER_ADMIN")), false);
    assert.equal(canRunCardBulkOperation("reassign", null, abilityFor("SUPER_ADMIN")), false);
});
