import assert from "node:assert/strict";
import test from "node:test";

import { homePathForRole, managementDestinationsForRole } from "../src/lib/auth/navigation.ts";

const expected = {
    SUPER_ADMIN: ["companies", "stores", "products", "users", "wallets", "prices", "rates"],
    SYSTEM_ADMIN: ["companies", "stores", "products", "users", "wallets", "prices", "rates"],
    OWNER: ["companies", "stores", "users", "prices", "rates"],
    GENERAL_ADMIN: ["companies", "stores", "users", "prices", "rates"],
    ADMIN: ["stores", "users", "prices", "rates"],
    OPERATOR: [],
};

test("cada rol aterriza en su inicio operativo", () => {
    assert.equal(homePathForRole("SUPER_ADMIN"), "/admin");
    assert.equal(homePathForRole("SYSTEM_ADMIN"), "/admin");
    assert.equal(homePathForRole("OWNER"), "/overview");
    assert.equal(homePathForRole("GENERAL_ADMIN"), "/overview");
    assert.equal(homePathForRole("ADMIN"), "/codes/purchase");
    assert.equal(homePathForRole("OPERATOR"), "/codes/purchase");
});

for (const [role, destinations] of Object.entries(expected)) {
    test(`Management aplica la matriz para ${role}`, () => {
        assert.deepEqual(managementDestinationsForRole(role), destinations);
    });
}
