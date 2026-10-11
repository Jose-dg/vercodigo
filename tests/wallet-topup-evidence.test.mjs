import assert from "node:assert/strict";
import test from "node:test";

import { receiptForm, sendReceiptBatches } from "../src/lib/wallet/receipt-upload.ts";
import {
    EVIDENCE_MAX_BYTES,
    EVIDENCE_MAX_FILES,
    acceptSelection,
    evidenceCountLabel,
    evidenceFileError,
    fitWithin,
    isEvidenceStorageError,
    looksLikeEvidence,
    planEvidenceBatches,
    sniffEvidenceType,
} from "../src/lib/wallet/topup-evidence.ts";

const bytes = (...parts) => new Uint8Array(parts.flatMap((part) => (
    typeof part === "string" ? [...part].map((char) => char.charCodeAt(0)) : part
)));

test("the receipt type comes from its bytes, never from the name", () => {
    assert.equal(sniffEvidenceType(bytes([0xff, 0xd8, 0xff, 0xe0], "JFIF")), "image/jpeg");
    assert.equal(sniffEvidenceType(bytes("\x89PNG\r\n\x1a\n", [0, 0])), "image/png");
    assert.equal(sniffEvidenceType(bytes("RIFF", [0, 0, 0, 0], "WEBPVP8 ")), "image/webp");
    assert.equal(sniffEvidenceType(bytes("%PDF-1.7\n")), "application/pdf");
    // iPhone photo: ISO box "ftyp" with brand heic.
    assert.equal(sniffEvidenceType(bytes([0, 0, 0, 0x18], "ftypheic", [0, 0, 0, 0], "mif1heic")), "image/heic");
    assert.equal(sniffEvidenceType(bytes([0, 0, 0, 0x14], "ftypmif1", [0, 0, 0, 0], "mif1")), "image/heif");
    // AVIF shares mif1 but is not accepted; HTML renamed to .jpg neither.
    assert.equal(sniffEvidenceType(bytes([0, 0, 0, 0x1c], "ftypavif", [0, 0, 0, 0], "avifmif1miaf")), null);
    assert.equal(sniffEvidenceType(bytes("<html><script>")), null);
    assert.equal(sniffEvidenceType(bytes("GIF89a")), null);
});

test("the picker accepts photos and PDFs, including HEIC without a MIME type", () => {
    assert.equal(looksLikeEvidence({ name: "IMG_0001.HEIC", type: "" }), true);
    assert.equal(looksLikeEvidence({ name: "extracto.pdf", type: "application/pdf" }), true);
    assert.equal(looksLikeEvidence({ name: "foto", type: "image/jpeg" }), true);
    assert.equal(looksLikeEvidence({ name: "notas.docx", type: "application/msword" }), false);
});

test("each file has a size limit below Vercel's body limit and cannot be empty", () => {
    assert.ok(EVIDENCE_MAX_BYTES < 4.5 * 1024 * 1024);
    assert.equal(evidenceFileError({ name: "a.jpg", type: "image/jpeg", size: 1000 }), null);
    assert.match(evidenceFileError({ name: "a.jpg", type: "image/jpeg", size: 0 }), /vacío/);
    assert.match(evidenceFileError({ name: "a.jpg", type: "image/jpeg", size: EVIDENCE_MAX_BYTES + 1 }), /máximo es 4,0 MB/);
    assert.match(evidenceFileError({ name: "a.exe", type: "application/x-msdownload", size: 10 }), /foto o un PDF/);
});

test("at most three receipts per payment, counting the ones already attached", () => {
    const file = { name: "a.jpg", type: "image/jpeg", size: 1 };
    assert.equal(EVIDENCE_MAX_FILES, 3);
    assert.deepEqual(acceptSelection(0, [file, file]), { accepted: 2, error: null });
    const capped = acceptSelection(1, [file, file, file]);
    assert.equal(capped.accepted, 2);
    assert.match(capped.error, /primeros 2/);
    assert.equal(acceptSelection(3, [file]).accepted, 0);
    assert.match(acceptSelection(3, [file]).error, /máximo/);
});

test("photos shrink to fit 2000 px on their longest side and never grow", () => {
    assert.deepEqual(fitWithin(4032, 3024), { width: 2000, height: 1500, scaled: true });
    assert.deepEqual(fitWithin(1170, 2532), { width: 924, height: 2000, scaled: true });
    assert.deepEqual(fitWithin(800, 600), { width: 800, height: 600, scaled: false });
});

test("files are grouped into requests under the budget, in order", () => {
    const sized = (...sizes) => sizes.map((size, index) => ({ id: index, size }));
    assert.deepEqual(planEvidenceBatches([]), []);
    assert.deepEqual(planEvidenceBatches(sized(1, 2, 3), 10).map((batch) => batch.map((f) => f.id)), [[0, 1, 2]]);
    assert.deepEqual(planEvidenceBatches(sized(6, 6, 3), 10).map((batch) => batch.map((f) => f.id)), [[0], [1, 2]]);
    // A file at the limit travels alone.
    assert.deepEqual(planEvidenceBatches(sized(10, 1), 10).map((batch) => batch.length), [1, 1]);
});

test("batches go one by one with progress by bytes and stop at the first failure", async () => {
    const file = (size) => new File([new Uint8Array(size)], `f${size}.jpg`, { type: "image/jpeg" });
    const batches = [[file(30)], [file(70)], [file(10)]];
    const seen = [];
    const progress = [];
    const results = await sendReceiptBatches(
        batches,
        async (batch, onProgress) => {
            seen.push(batch[0].size);
            onProgress(1);
            return { ok: batch[0].size !== 70, status: batch[0].size === 70 ? 503 : 200, body: {} };
        },
        (fraction) => progress.push(fraction),
    );
    assert.deepEqual(seen, [30, 70], "nothing is sent after a failed batch");
    assert.deepEqual(results.map((result) => result.status), [200, 503]);
    assert.deepEqual(progress.map((value) => Math.round(value * 100)), [27, 91]);
});

test("receipt forms carry the fields and every file under 'files'", () => {
    const form = receiptForm([new File(["a"], "a.jpg"), new File(["b"], "b.pdf")], { bankReference: "M12345" });
    assert.equal(form.get("bankReference"), "M12345");
    assert.deepEqual(form.getAll("files").map((file) => file.name), ["a.jpg", "b.pdf"]);
});

test("only a receipt-storage outage makes the client report without receipts", () => {
    assert.equal(isEvidenceStorageError(503, "evidence_storage_unavailable"), true);
    assert.equal(isEvidenceStorageError(503, "evidence_storage_error"), true);
    assert.equal(isEvidenceStorageError(503, "TOPUP_UNAVAILABLE"), false);
    assert.equal(isEvidenceStorageError(422, "evidence_storage_error"), false);
    assert.equal(evidenceCountLabel(0), "Sin comprobante");
    assert.equal(evidenceCountLabel(1), "1 comprobante adjunto");
    assert.equal(evidenceCountLabel(2), "2 comprobantes adjuntos");
});
