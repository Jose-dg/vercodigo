/**
 * "Enviar a varios (CSV)": one row per person, one code of the chosen product
 * each. Columns nombre,apellido,email; header optional; "," or ";" (Excel in
 * Spanish saves with ";").
 */
import {
    InvalidDeliveryRecipientError,
    normalizeDeliveryRecipient,
    type DeliveryRecipient,
} from "./delivery-recipient.ts";

export const MAX_CSV_RECIPIENTS = 200;

export const RECIPIENTS_CSV_TEMPLATE = "nombre,apellido,email\nLuis,Gómez,luis@ejemplo.com\nAna,Ruiz,ana@ejemplo.com\n";

export type CsvRecipientRow = { line: number; recipient: DeliveryRecipient };
export type CsvRecipientError = { line: number; message: string };
export type ParsedRecipientsCsv = { rows: CsvRecipientRow[]; errors: CsvRecipientError[] };

function splitLine(line: string, separator: string): string[] {
    const cells: string[] = [];
    let current = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        if (char === '"') {
            if (quoted && line[index + 1] === '"') {
                current += '"';
                index += 1;
            } else {
                quoted = !quoted;
            }
        } else if (char === separator && !quoted) {
            cells.push(current);
            current = "";
        } else {
            current += char;
        }
    }
    cells.push(current);
    return cells.map((cell) => cell.trim());
}

const HEADER = /^(nombre|first.?name|name)$/i;

export function parseRecipientsCsv(text: string): ParsedRecipientsCsv {
    const lines = text.replace(/^﻿/, "").split(/\r?\n/);
    const firstContent = lines.find((line) => line.trim()) ?? "";
    const separator = (firstContent.match(/;/g)?.length ?? 0) > (firstContent.match(/,/g)?.length ?? 0) ? ";" : ",";
    const rows: CsvRecipientRow[] = [];
    const errors: CsvRecipientError[] = [];
    const seen = new Map<string, number>();
    let headerSkipped = false;

    lines.forEach((raw, index) => {
        const line = index + 1;
        if (!raw.trim()) return;
        const cells = splitLine(raw, separator);
        if (!headerSkipped && rows.length === 0 && errors.length === 0 && HEADER.test(cells[0] ?? "")) {
            headerSkipped = true;
            return;
        }
        if (cells.length < 3) {
            errors.push({ line, message: "Faltan columnas: se esperan nombre, apellido y email" });
            return;
        }
        try {
            const recipient = normalizeDeliveryRecipient({ firstName: cells[0], lastName: cells[1], email: cells[2] });
            const duplicateOf = seen.get(recipient.email);
            if (duplicateOf) {
                errors.push({ line, message: `Email repetido (ya está en la fila ${duplicateOf})` });
                return;
            }
            seen.set(recipient.email, line);
            rows.push({ line, recipient });
        } catch (error) {
            if (!(error instanceof InvalidDeliveryRecipientError)) throw error;
            errors.push({ line, message: error.message });
        }
    });

    if (rows.length > MAX_CSV_RECIPIENTS) {
        errors.push({ line: rows[MAX_CSV_RECIPIENTS].line, message: `Máximo ${MAX_CSV_RECIPIENTS} destinatarios por archivo` });
    }
    if (rows.length === 0 && errors.length === 0) {
        errors.push({ line: 1, message: "El archivo no tiene destinatarios" });
    }
    return { rows, errors };
}

/**
 * Idempotency-Key of one row: the same file, product and row always produce
 * the same key, so re-uploading or retrying never buys twice.
 */
export async function csvRowIdempotencyKey(params: {
    fileText: string;
    productId: string;
    denominationId: string | null;
    line: number;
}): Promise<string> {
    const data = new TextEncoder().encode(
        `${params.productId}\u0000${params.denominationId ?? ""}\u0000${params.fileText}`,
    );
    const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
    const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `csv-${hex.slice(0, 40)}-${params.line}`;
}

function csvCell(value: string): string {
    return /[",\n;]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Per-row outcome file offered when the batch ends. */
export function recipientsResultCsv(
    results: { line: number; recipient: DeliveryRecipient; orderId: string | null; status: string; message: string }[],
): string {
    const header = "fila,nombre,apellido,email,orden,estado,mensaje";
    const body = results.map((row) => [
        String(row.line),
        row.recipient.firstName,
        row.recipient.lastName,
        row.recipient.email,
        row.orderId ?? "",
        row.status,
        row.message,
    ].map(csvCell).join(","));
    return [header, ...body].join("\n") + "\n";
}
