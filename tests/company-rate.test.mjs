import test from "node:test";
import assert from "node:assert/strict";
import { calculateCompanyRateAmount } from "../src/lib/pricing/company-rate.ts";

test("US$100 a 3.190 produce $319.000 COP", () => {
    assert.deepEqual(
        calculateCompanyRateAmount({ denominationUsd: 100, rateCopPerUsd: 3190 }),
        { unitAmountCop: 319000, totalAmountCop: 319000 },
    );
});

test("una tasa cubre denominaciones y cantidades distintas", () => {
    assert.equal(calculateCompanyRateAmount({ denominationUsd: 10, rateCopPerUsd: 3370, quantity: 2 }).totalAmountCop, 67400);
    assert.equal(calculateCompanyRateAmount({ denominationUsd: 25, rateCopPerUsd: 3370 }).unitAmountCop, 84250);
    assert.equal(calculateCompanyRateAmount({ denominationUsd: 75, rateCopPerUsd: 3370 }).unitAmountCop, 252750);
});
