/**
 * Receipts (comprobantes) attached to a reported top-up.
 * Pure functions: no I/O, safe on server and client.
 *
 * DevDiem stores and validates them too (up to 3 per payment, 8 MB each, type
 * read from the bytes). The portal's limit per file is lower because every
 * request crosses a Vercel Function, whose body limit is 4.5 MB: photos are
 * compressed in the browser and files that do not fit in one request travel
 * in the next one.
 */

export const EVIDENCE_MAX_FILES = 3;
/** Per file and per request: below Vercel's 4.5 MB body limit, with room for the form. */
export const EVIDENCE_MAX_BYTES = 4 * 1024 * 1024;
export const EVIDENCE_ACCEPT = 'image/*,application/pdf';
/** Photos are resized to fit this box (px) before upload. */
export const EVIDENCE_MAX_DIMENSION = 2000;
export const EVIDENCE_JPEG_QUALITY = 0.8;

export type EvidenceMimeType =
    | 'image/jpeg'
    | 'image/png'
    | 'image/webp'
    | 'image/heic'
    | 'image/heif'
    | 'application/pdf';

const HEIC_BRANDS = new Set(['heic', 'heix', 'heim', 'heis', 'hevc', 'hevx', 'hevm', 'hevs']);
const HEIF_BRANDS = new Set(['mif1', 'msf1', 'heif']);

function ascii(bytes: Uint8Array, start: number, end: number): string {
    return String.fromCharCode(...bytes.subarray(start, end));
}

/** Same rule as DevDiem: the type comes from the first bytes, never the name. */
export function sniffEvidenceType(head: Uint8Array): EvidenceMimeType | null {
    if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'image/jpeg';
    if (head.length >= 8 && ascii(head, 0, 8) === '\x89PNG\r\n\x1a\n') return 'image/png';
    if (head.length >= 12 && ascii(head, 0, 4) === 'RIFF' && ascii(head, 8, 12) === 'WEBP') return 'image/webp';
    if (head.length >= 5 && ascii(head, 0, 5) === '%PDF-') return 'application/pdf';
    if (head.length >= 16 && ascii(head, 4, 8) === 'ftyp') {
        const boxSize = ((head[0] << 24) | (head[1] << 16) | (head[2] << 8) | head[3]) >>> 0;
        const end = Math.min(Math.max(boxSize, 16), head.length);
        const major = ascii(head, 8, 12);
        const brands = new Set([major]);
        for (let i = 16; i + 4 <= end; i += 4) brands.add(ascii(head, i, i + 4));
        if ([...brands].some((brand) => HEIC_BRANDS.has(brand))) return 'image/heic';
        // mif1 also heads AVIF files, which are not accepted.
        if (HEIF_BRANDS.has(major) && !brands.has('avif') && !brands.has('avis')) return 'image/heif';
    }
    return null;
}

export type EvidenceCandidate = { name: string; size: number; type: string };

/** Accepted by the picker before reading the file (the server checks the bytes). */
export function looksLikeEvidence(file: Pick<EvidenceCandidate, 'name' | 'type'>): boolean {
    if (file.type.startsWith('image/') || file.type === 'application/pdf') return true;
    // Some Android galleries report HEIC (and some PDFs) with an empty type.
    return /\.(jpe?g|png|webp|heic|heif|pdf)$/i.test(file.name);
}

export function isCompressibleImage(type: string): boolean {
    // HEIC is tried too: Safari decodes it; elsewhere the decode fails and it goes as is.
    return type.startsWith('image/') && type !== 'image/gif' && type !== 'image/svg+xml';
}

/** Size that fits `max` on its longest side, keeping the aspect ratio. Never upscales. */
export function fitWithin(width: number, height: number, max = EVIDENCE_MAX_DIMENSION) {
    const longest = Math.max(width, height);
    if (longest <= max) return { width, height, scaled: false };
    const ratio = max / longest;
    return { width: Math.round(width * ratio), height: Math.round(height * ratio), scaled: true };
}

export type SelectionResult = { accepted: number; error: string | null };

/** How many of `incoming` fit next to `existing` files; explains the rest. */
export function acceptSelection(existing: number, incoming: EvidenceCandidate[]): SelectionResult {
    const room = Math.max(0, EVIDENCE_MAX_FILES - existing);
    if (incoming.length > room) {
        return {
            accepted: room,
            error: room === 0
                ? `Ya adjuntaste ${EVIDENCE_MAX_FILES} comprobantes, el máximo.`
                : `Puedes adjuntar hasta ${EVIDENCE_MAX_FILES} comprobantes. Tomamos los primeros ${room}.`,
        };
    }
    return { accepted: incoming.length, error: null };
}

/** Problem with one prepared file, or null if it can be uploaded. */
export function evidenceFileError(file: EvidenceCandidate): string | null {
    if (!looksLikeEvidence(file)) return `${file.name}: debe ser una foto o un PDF.`;
    return evidenceSizeError(file);
}

export function evidenceSizeError(file: Pick<EvidenceCandidate, 'name' | 'size'>): string | null {
    if (file.size === 0) return `${file.name}: el archivo está vacío.`;
    if (file.size > EVIDENCE_MAX_BYTES) {
        return `${file.name} pesa ${formatBytes(file.size)}; el máximo es ${formatBytes(EVIDENCE_MAX_BYTES)}.`;
    }
    return null;
}

/**
 * Groups files into requests under `budget` bytes, keeping their order. The
 * first group travels with the report; the rest are added afterwards.
 */
export function planEvidenceBatches<T extends { size: number }>(files: T[], budget = EVIDENCE_MAX_BYTES): T[][] {
    const batches: T[][] = [];
    let current: T[] = [];
    let used = 0;
    for (const file of files) {
        if (current.length > 0 && used + file.size > budget) {
            batches.push(current);
            current = [];
            used = 0;
        }
        current.push(file);
        used += file.size;
    }
    if (current.length > 0) batches.push(current);
    return batches;
}

export function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

export function evidenceCountLabel(count: number): string {
    if (count <= 0) return 'Sin comprobante';
    return count === 1 ? '1 comprobante adjunto' : `${count} comprobantes adjuntos`;
}

/** DevDiem could not store receipts (not configured or down): report without them. */
export function isEvidenceStorageError(status: number, code: unknown): boolean {
    return status === 503 && typeof code === 'string' && code.startsWith('evidence_storage');
}
