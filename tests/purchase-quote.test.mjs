import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { computeCost } from "../src/lib/pricing/resolve-cost.ts";

const base = {
    companyId: "company-a",
    walletCurrency: "COP",
    companyRateCopPerUsd: null,
    fallbackRateCopPerUsd: 3600,
};

test("un producto COP (Free Fire 1060) cotiza su costo global en COP", () => {
    const cost = computeCost({
        ...base,
        denomination: { amount: 38600, currency: "COP" },
        costs: [{ companyId: null, cost: 38600, currency: "COP" }],
    });
    assert.deepEqual(cost, { amount: 38600, currency: "COP", source: "global" });
});

test("sin costo configurado, un producto COP cobra su valor nominal", () => {
    const cost = computeCost({ ...base, denomination: { amount: 30000, currency: "COP" }, costs: [] });
    assert.deepEqual(cost, { amount: 30000, currency: "COP", source: "denomination" });
});

test("el costo de la compañía tiene prioridad sobre el global", () => {
    const cost = computeCost({
        ...base,
        denomination: { amount: 10, currency: "USD" },
        costs: [
            { companyId: null, cost: 36000, currency: "COP" },
            { companyId: "company-a", cost: 34000, currency: "COP" },
        ],
    });
    assert.equal(cost.amount, 34000);
    assert.equal(cost.source, "company");
});

test("la tarifa negociada aplica solo a denominaciones USD en wallet COP", () => {
    const usd = computeCost({
        ...base,
        companyRateCopPerUsd: 3370,
        denomination: { amount: 10, currency: "USD" },
        costs: [{ companyId: null, cost: 36000, currency: "COP" }],
    });
    assert.deepEqual(usd, {
        amount: 33700,
        currency: "COP",
        source: "company_rate",
        sourceAmount: 10,
        sourceCurrency: "USD",
        exchangeRate: 3370,
    });

    const cop = computeCost({
        ...base,
        companyRateCopPerUsd: 3370,
        denomination: { amount: 20000, currency: "COP" },
        costs: [{ companyId: null, cost: 20000, currency: "COP" }],
    });
    assert.equal(cop.amount, 20000);
    assert.equal(cop.source, "global");
});

test("un costo USD se convierte con FX_USD_COP a una wallet COP", () => {
    const cost = computeCost({
        ...base,
        denomination: { amount: 10, currency: "USD" },
        costs: [{ companyId: null, cost: 10, currency: "USD" }],
    });
    assert.equal(cost.amount, 36000);
    assert.equal(cost.currency, "COP");
    assert.equal(cost.exchangeRate, 3600);
});

test("el checkout cotiza con la misma regla que el cobro, no con las tarifas USD", async () => {
    const page = await readFile(new URL("../src/app/(root)/codes/purchase/page.tsx", import.meta.url), "utf8");
    const service = await readFile(new URL("../src/services/costing/costing.service.ts", import.meta.url), "utf8");
    assert.match(page, /\/api\/codes\/quotes/);
    assert.doesNotMatch(page, /\/api\/billing-rates/);
    const resolveCost = service.slice(service.indexOf("export async function resolveCost"));
    const quotes = service.slice(service.indexOf("export async function getPurchaseQuotes"));
    assert.match(resolveCost.slice(0, resolveCost.indexOf("\n}\n")), /computeCost\(/);
    assert.match(quotes.slice(0, quotes.indexOf("\n}\n")), /computeCost\(/);
});
