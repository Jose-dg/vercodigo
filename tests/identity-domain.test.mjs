import assert from "node:assert/strict";
import test from "node:test";

import {
    generateReadablePassword,
    normalizeEmail,
    passwordIssues,
    safeCallbackPath,
} from "../src/modules/identity/domain.ts";

const ORIGIN = "https://vercode.me";

test("el correo se normaliza: el teclado del celular ya no rompe el login", () => {
    assert.equal(normalizeEmail("  Jose@Empresa.CO "), "jose@empresa.co");
});

test("el destino después del login solo puede ser una ruta interna", () => {
    assert.equal(safeCallbackPath("/codes/purchases/abc", ORIGIN), "/codes/purchases/abc");
    assert.equal(safeCallbackPath("https://vercode.me/wallet?x=1#recargas", ORIGIN), "/wallet?x=1#recargas");
    assert.equal(safeCallbackPath("https://evil.example/phish", ORIGIN), null);
    assert.equal(safeCallbackPath("//evil.example/phish", ORIGIN), null);
    assert.equal(safeCallbackPath("javascript:alert(1)", ORIGIN), null);
    assert.equal(safeCallbackPath("/login?callbackUrl=/x", ORIGIN), null);
    assert.equal(safeCallbackPath("", ORIGIN), null);
    assert.equal(safeCallbackPath(null, ORIGIN), null);
});

test("la contraseña generada es legible y cumple la política", () => {
    let seed = 7;
    const randomInt = (max) => (seed = (seed * 1103515245 + 12345) % 2147483648) % max;
    const password = generateReadablePassword(randomInt);
    assert.match(password, /^[A-Za-z]+-[A-Za-z]+-[A-Za-z]+-\d{4}$/);
    assert.deepEqual(passwordIssues(password, "ana@empresa.co"), []);
});

test("la política rechaza claves cortas o que contienen el correo", () => {
    assert.deepEqual(passwordIssues("corta", null), ["too_short"]);
    assert.deepEqual(passwordIssues("mariana2026!!", "mariana@empresa.co"), ["contains_email"]);
});
