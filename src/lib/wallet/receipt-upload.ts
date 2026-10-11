/**
 * Browser side of receipt uploads: shrink phone photos before they leave the
 * device and send forms with upload progress. Dependency free (canvas + XHR).
 */
import {
    EVIDENCE_JPEG_QUALITY,
    EVIDENCE_MAX_DIMENSION,
    fitWithin,
    isCompressibleImage,
} from './topup-evidence.ts';

/** Below this size a photo that already fits the box is sent untouched. */
const KEEP_ORIGINAL_BELOW_BYTES = 1024 * 1024;

async function decode(file: File): Promise<ImageBitmap | null> {
    try {
        // from-image applies the EXIF rotation, so portrait photos stay upright.
        return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
        return null; // e.g. HEIC outside Safari: the file goes as is.
    }
}

function toJpeg(canvas: HTMLCanvasElement): Promise<Blob | null> {
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', EVIDENCE_JPEG_QUALITY));
}

/**
 * A JPEG at most EVIDENCE_MAX_DIMENSION px on its longest side, or the original
 * when it cannot be decoded, is already small, or compressing would not help.
 */
export async function compressReceipt(file: File): Promise<File> {
    if (!isCompressibleImage(file.type) && !/\.(heic|heif)$/i.test(file.name)) return file;
    const bitmap = await decode(file);
    if (!bitmap) return file;
    try {
        const size = fitWithin(bitmap.width, bitmap.height, EVIDENCE_MAX_DIMENSION);
        if (!size.scaled && file.size <= KEEP_ORIGINAL_BELOW_BYTES && file.type !== 'image/heic') return file;
        const canvas = document.createElement('canvas');
        canvas.width = size.width;
        canvas.height = size.height;
        const context = canvas.getContext('2d');
        if (!context) return file;
        // White under transparent PNG screenshots, which JPEG would turn black.
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, size.width, size.height);
        context.drawImage(bitmap, 0, 0, size.width, size.height);
        const blob = await toJpeg(canvas);
        if (!blob || blob.size >= file.size) return file;
        const name = `${file.name.replace(/\.[^.]+$/, '') || 'comprobante'}.jpg`;
        return new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified });
    } finally {
        bitmap.close();
    }
}

export type UploadResult = { ok: boolean; status: number; body: Record<string, unknown> };

/** POSTs a form and reports upload progress (0..1). fetch cannot report it. */
export function postFormWithProgress(
    url: string,
    form: FormData,
    onProgress: (fraction: number) => void,
): Promise<UploadResult> {
    return new Promise((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open('POST', url);
        request.responseType = 'json';
        request.upload.onprogress = (event) => {
            if (event.lengthComputable) onProgress(event.loaded / event.total);
        };
        request.onload = () => {
            onProgress(1);
            const body = (request.response ?? {}) as Record<string, unknown>;
            resolve({ ok: request.status >= 200 && request.status < 300, status: request.status, body });
        };
        request.onerror = () => reject(new Error('Sin conexión. Revisa tu red e intenta de nuevo.'));
        request.ontimeout = () => reject(new Error('La subida tardó demasiado. Intenta de nuevo.'));
        request.timeout = 120_000;
        request.send(form);
    });
}

export function receiptForm(files: File[], fields: Record<string, string> = {}): FormData {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) form.append(key, value);
    for (const file of files) form.append('files', file, file.name);
    return form;
}

/**
 * Sends batches one after another, reporting overall progress by bytes. Stops
 * at the first failed batch; its result is the last one returned.
 */
export async function sendReceiptBatches(
    batches: File[][],
    send: (batch: File[], onProgress: (fraction: number) => void) => Promise<UploadResult>,
    onProgress: (fraction: number) => void,
): Promise<UploadResult[]> {
    const bytes = (batch: File[]) => batch.reduce((sum, file) => sum + file.size, 0);
    const total = batches.reduce((sum, batch) => sum + bytes(batch), 0) || 1;
    const results: UploadResult[] = [];
    let done = 0;
    for (const batch of batches) {
        const size = bytes(batch);
        const result = await send(batch, (fraction) => onProgress((done + fraction * size) / total));
        results.push(result);
        if (!result.ok) break;
        done += size;
    }
    return results;
}
