import assert from "node:assert/strict";
import test from "node:test";

import { summarizeCodeDelivery } from "../src/lib/codes/delivery-counts.ts";

test("completed historical purchases preserve billed and delivered counts separately", () => {
    const result = summarizeCodeDelivery({
        status: "COMPLETED",
        billedCount: 1,
        deliveredCodes: ["first-code", "second-code"],
    });

    assert.equal(result.deliveredCodeCount, 2);
    assert.equal(result.hasDeliveryCountMismatch, true);
    assert.deepEqual(result.codes, ["first-code", "second-code"]);
});

test("pending purchases do not report a historical mismatch", () => {
    const result = summarizeCodeDelivery({
        status: "PENDING",
        billedCount: 2,
        deliveredCodes: ["one-code"],
    });

    assert.equal(result.deliveredCodeCount, 1);
    assert.equal(result.hasDeliveryCountMismatch, false);
});

test("non-string delivery payload values are ignored", () => {
    const result = summarizeCodeDelivery({
        status: "COMPLETED",
        billedCount: 1,
        deliveredCodes: ["valid-code", null, 7, { code: "hidden" }],
    });

    assert.deepEqual(result.codes, ["valid-code"]);
    assert.equal(result.hasDeliveryCountMismatch, false);
});
