import assert from "node:assert/strict";
import test from "node:test";

import { isCardUuid, parseCardCodes } from "../src/lib/cards/card-uuid.ts";

test("only 8-char codes from the unambiguous alphabet are card codes", () => {
    assert.equal(isCardUuid("FJ2ZSKXB"), true);
    assert.equal(isCardUuid("FJ2ZSKX"), false); // short
    assert.equal(isCardUuid("FJ2ZSKXBB"), false); // long
    assert.equal(isCardUuid("FJ2ZSKX0"), false); // 0 is not in the alphabet
    assert.equal(isCardUuid("FJ2ZSKXO"), false); // neither is O
    assert.equal(isCardUuid("FJ2ZSKX1"), false);
    assert.equal(isCardUuid("FJ2ZSKXI"), false);
    assert.equal(isCardUuid("fj2zskxb"), false); // callers normalize first
});

test("pasted text becomes unique uppercase codes, keeping invalid tokens as typed", () => {
    const parsed = parseCardCodes(" fj2zskxb, BZV2L2FQ;BZV2L2FQ\n\nBUB7J53\tHOLA-123 FJ2ZSKXB ");
    assert.deepEqual(parsed.codes, ["FJ2ZSKXB", "BZV2L2FQ"]);
    assert.deepEqual(parsed.invalid, ["BUB7J53", "HOLA-123"]);
    assert.equal(parsed.duplicates, 2);
});

test("a scanned QR link counts as its code", () => {
    const parsed = parseCardCodes("https://app.vercode.me/scan/p8nb74pn\nhttp://localhost:3000/scan/HAPSGFK3/");
    assert.deepEqual(parsed.codes, ["P8NB74PN", "HAPSGFK3"]);
    assert.deepEqual(parsed.invalid, []);
});

test("a link that does not end in a card code is invalid", () => {
    const parsed = parseCardCodes("https://app.vercode.me/scan/ https://example.com/otra-cosa");
    assert.deepEqual(parsed.codes, []);
    assert.equal(parsed.invalid.length, 2);
});

test("empty input has nothing to count", () => {
    assert.deepEqual(parseCardCodes("  \n , "), { codes: [], invalid: [], duplicates: 0 });
});
