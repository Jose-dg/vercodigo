import test from "node:test";
import assert from "node:assert/strict";

import {
    formatPurchaseTargetStore,
    purchaseTargetWarning,
} from "../src/lib/codes/purchase-target.ts";

test("platform store options distinguish name, code and address", () => {
    assert.equal(
        formatPurchaseTargetStore({
            name: "Laboratorio Clínica del Play 193",
            code: "PLAY193",
            address: "Palacio Nacional Local 193",
        }),
        "Laboratorio Clínica del Play 193 · PLAY193 · Palacio Nacional Local 193",
    );
});

test("empty optional display parts do not leave broken separators", () => {
    assert.equal(
        formatPurchaseTargetStore({ name: "Sede 193", code: "", address: "" }),
        "Sede 193",
    );
});

test("checkout warning names both the payer and the commercial origin", () => {
    assert.equal(
        purchaseTargetWarning("Laboratorio Clínica del Play", "Laboratorio Clínica del Play 193"),
        "El cargo se hará a Laboratorio Clínica del Play y la compra quedará atribuida a Laboratorio Clínica del Play 193.",
    );
});
