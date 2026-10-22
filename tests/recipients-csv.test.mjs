import assert from "node:assert/strict";
import test from "node:test";

import {
    MAX_CSV_RECIPIENTS,
    csvRowIdempotencyKey,
    parseRecipientsCsv,
    recipientsResultCsv,
} from "../src/lib/codes/recipients-csv.ts";

test("comma file with header becomes normalized recipients", () => {
    const { rows, errors } = parseRecipientsCsv("nombre,apellido,email\nLuis,Gómez, Luis@Ejemplo.com \n\nAna,,ana@ejemplo.com\n");
    assert.deepEqual(errors, []);
    assert.deepEqual(rows.map((row) => [row.line, row.recipient.email, row.recipient.lastName]), [
        [2, "luis@ejemplo.com", "Gómez"],
        [4, "ana@ejemplo.com", ""],
    ]);
});

test("Excel semicolon files, quotes and a BOM are understood", () => {
    const { rows, errors } = parseRecipientsCsv('﻿Luis;"Gómez; Pérez";luis@ejemplo.com\r\n');
    assert.deepEqual(errors, []);
    assert.equal(rows[0].recipient.lastName, "Gómez; Pérez");
});

test("invalid, incomplete and repeated rows are reported by line", () => {
    const { rows, errors } = parseRecipientsCsv("Luis,Gómez,luis@ejemplo.com\nAna,Ruiz,no-es-email\nSolo,dos\nLuis,Otra,LUIS@ejemplo.com\n");
    assert.equal(rows.length, 1);
    assert.deepEqual(errors.map((error) => error.line), [2, 3, 4]);
    assert.match(errors[2].message, /repetido.*fila 1/);
});

test("more than the limit is an error and an empty file too", () => {
    const many = Array.from({ length: MAX_CSV_RECIPIENTS + 1 }, (_, index) => `P${index},X,p${index}@ejemplo.com`).join("\n");
    assert.match(parseRecipientsCsv(many).errors.at(-1).message, /Máximo/);
    assert.match(parseRecipientsCsv("nombre,apellido,email\n").errors[0].message, /no tiene destinatarios/);
});

test("the same file, product and row always give the same Idempotency-Key", async () => {
    const base = { fileText: "Luis,Gómez,luis@ejemplo.com\n", productId: "p1", denominationId: "d1", line: 1 };
    const key = await csvRowIdempotencyKey(base);
    assert.match(key, /^csv-[0-9a-f]{40}-1$/);
    assert.equal(await csvRowIdempotencyKey(base), key);
    assert.notEqual(await csvRowIdempotencyKey({ ...base, line: 2 }), key);
    assert.notEqual(await csvRowIdempotencyKey({ ...base, denominationId: "d2" }), key);
    assert.notEqual(await csvRowIdempotencyKey({ ...base, fileText: `${base.fileText}Ana,Ruiz,ana@ejemplo.com\n` }), key);
});

test("the results file quotes cells that need it", () => {
    const csv = recipientsResultCsv([{
        line: 2, recipient: { firstName: "Luis", lastName: "Gómez, Jr", email: "luis@ejemplo.com" },
        orderId: "cm1", status: "ok", message: "",
    }]);
    assert.equal(csv.split("\n")[1], '2,Luis,"Gómez, Jr",luis@ejemplo.com,cm1,ok,');
});
