import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { computeCost } from "../src/lib/pricing/resolve-cost.ts";

const base = {
    companyId: "company-a",
    walletCurrency: "COP",
    usdWholesaleRateCopPerUsd: null,
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

test("la TRM del día cobra las denominaciones USD de región USA en wallet COP", () => {
    const usd = computeCost({
        ...base,
        usdWholesaleRateCopPerUsd: 3170,
        denomination: { amount: 10, currency: "USD", countryRegion: "united_states" },
        costs: [{ companyId: null, cost: 36000, currency: "COP" }],
    });
    assert.deepEqual(usd, {
        amount: 31700,
        currency: "COP",
        source: "trm",
        sourceAmount: 10,
        sourceCurrency: "USD",
        exchangeRate: 3170,
    });
});

test("la TRM no aplica a productos USD de otra región ni a productos COP", () => {
    const colombia = computeCost({
        ...base,
        usdWholesaleRateCopPerUsd: 3170,
        denomination: { amount: 10, currency: "USD", countryRegion: "colombia" },
        costs: [{ companyId: null, cost: 40000, currency: "COP" }],
    });
    assert.equal(colombia.amount, 40000);
    assert.equal(colombia.source, "global");

    const cop = computeCost({
        ...base,
        usdWholesaleRateCopPerUsd: 3170,
        denomination: { amount: 20000, currency: "COP", countryRegion: "united_states" },
        costs: [{ companyId: null, cost: 20000, currency: "COP" }],
    });
    assert.equal(cop.amount, 20000);
    assert.equal(cop.source, "global");
});

test("sin región sincronizada o sin TRM, la denominación USA conserva su costo configurado", () => {
    const sinRegion = computeCost({
        ...base,
        usdWholesaleRateCopPerUsd: 3170,
        denomination: { amount: 10, currency: "USD", countryRegion: null },
        costs: [{ companyId: null, cost: 36000, currency: "COP" }],
    });
    assert.equal(sinRegion.amount, 36000);

    const sinTrm = computeCost({
        ...base,
        denomination: { amount: 10, currency: "USD", countryRegion: "united_states" },
        costs: [{ companyId: null, cost: 36000, currency: "COP" }],
    });
    assert.equal(sinTrm.amount, 36000);
    assert.equal(sinTrm.source, "global");
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

test("el costo se redondea a centavos para que cotización, débito y orden Diem coincidan", () => {
    const cost = computeCost({
        ...base,
        denomination: { amount: 10, currency: "USD" },
        costs: [{ companyId: "company-a", cost: 33333.3333, currency: "COP" }],
    });
    assert.equal(cost.amount, 33333.33);
});
