import test from "node:test";
import assert from "node:assert/strict";

import {
    bogotaDate,
    parseTrmResponse,
    roundTrmDown,
    trmCoversDate,
    trmQueryUrl,
    trmStaleDays,
    wholesaleRateFromTrm,
} from "../src/lib/pricing/trm.ts";

test("la TRM se redondea hacia abajo a la decena", () => {
    assert.equal(roundTrmDown(3174.67), 3170);
    assert.equal(roundTrmDown(3179.99), 3170);
    assert.equal(roundTrmDown(3170), 3170);
    assert.equal(roundTrmDown(3169.99), 3160);
});

test("la tasa mayorista es la TRM redondeada más el margen", () => {
    assert.equal(wholesaleRateFromTrm({ trmCop: 3174.67, spreadCop: 0 }), 3170);
    assert.equal(wholesaleRateFromTrm({ trmCop: 3174.67, spreadCop: 50 }), 3220);
});

test("interpreta la respuesta del dataset oficial de datos.gov.co", () => {
    const body = [{
        valor: "3174.67",
        unidad: "COP",
        vigenciadesde: "2026-10-17T00:00:00.000",
        vigenciahasta: "2026-10-19T00:00:00.000",
    }];
    assert.deepEqual(parseTrmResponse(body), { valueCop: 3174.67, validFrom: "2026-10-17", validTo: "2026-10-19" });
});

test("rechaza respuestas vacías, corruptas o fuera de rango", () => {
    assert.equal(parseTrmResponse([]), null);
    assert.equal(parseTrmResponse({ error: "x" }), null);
    assert.equal(parseTrmResponse([{ valor: "abc", vigenciadesde: "2026-10-17T00:00:00", vigenciahasta: "2026-10-17T00:00:00" }]), null);
    assert.equal(parseTrmResponse([{ valor: "3.17", vigenciadesde: "2026-10-17T00:00:00", vigenciahasta: "2026-10-17T00:00:00" }]), null);
    assert.equal(parseTrmResponse([{ valor: "3174.67", vigenciadesde: "2026-10-19T00:00:00", vigenciahasta: "2026-10-17T00:00:00" }]), null);
});

test("una TRM de viernes rige el fin de semana", () => {
    const period = { validFrom: "2026-10-17", validTo: "2026-10-19" };
    assert.equal(trmCoversDate(period, "2026-10-18"), true);
    assert.equal(trmCoversDate(period, "2026-10-20"), false);
    assert.equal(trmStaleDays(period, "2026-10-18"), 0);
    assert.equal(trmStaleDays(period, "2026-10-22"), 3);
});

test("la fecha de hoy se toma en hora de Bogotá", () => {
    // 2026-10-19 03:00 UTC = 2026-10-18 22:00 en Bogotá.
    assert.equal(bogotaDate(new Date("2026-10-19T03:00:00Z")), "2026-10-18");
    assert.equal(bogotaDate(new Date("2026-10-19T05:00:00Z")), "2026-10-19");
});

test("la consulta pide la última TRM vigente desde hoy o antes", () => {
    const url = new URL(trmQueryUrl("2026-10-18"));
    assert.equal(url.origin + url.pathname, "https://www.datos.gov.co/resource/32sa-8pi3.json");
    assert.equal(url.searchParams.get("$where"), "vigenciadesde <= '2026-10-18T00:00:00'");
    assert.equal(url.searchParams.get("$order"), "vigenciadesde DESC");
    assert.equal(url.searchParams.get("$limit"), "1");
});
