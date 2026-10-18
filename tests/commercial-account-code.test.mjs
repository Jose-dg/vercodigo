import assert from "node:assert/strict";
import test from "node:test";

import { buildCommercialAccountCode, companyIdFromCommercialAccountCode } from "../src/lib/devdiem/fulfillment.ts";

// Las cuentas existentes en DevDiem usan este formato: cambiarlo las desvincula de su saldo.
test("la cuenta comercial de una empresa es diem-sas:<companyId>", () => {
    assert.equal(buildCommercialAccountCode("cmabc123"), "diem-sas:cmabc123");
    assert.equal(buildCommercialAccountCode("  cmabc123 "), "diem-sas:cmabc123");
});

test("solo se reconocen cuentas de diem-sas", () => {
    assert.equal(companyIdFromCommercialAccountCode("diem-sas:cmabc123"), "cmabc123");
    assert.equal(companyIdFromCommercialAccountCode("customer:378cacfc"), null);
    assert.equal(companyIdFromCommercialAccountCode("diem-sas:"), null);
    assert.equal(companyIdFromCommercialAccountCode("diem-sas:a:b"), null);
});
