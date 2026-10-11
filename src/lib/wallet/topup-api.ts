import { NextResponse } from 'next/server';

import type { DiemHttpError } from '@/lib/devdiem/fulfillment';
import type { EvidenceUpload } from '@/lib/devdiem/stored-value';
import { EVIDENCE_MAX_FILES, evidenceSizeError, sniffEvidenceType } from '@/lib/wallet/topup-evidence';

/** Maps a DevDiem error to a portal response without leaking internals. */
export function topUpErrorResponse(error: unknown, logContext: string) {
    const diem = error as DiemHttpError;
    if (typeof diem?.status === 'number' && diem.status >= 400 && diem.status < 500) {
        const detail = diem.detail as { code?: string; detail?: string } | undefined;
        return NextResponse.json(
            { error: detail?.code ?? 'TOPUP_REJECTED', message: detail?.detail ?? diem.message },
            { status: diem.status === 404 ? 404 : 422 },
        );
    }
    // Receipt storage is down: the client reports without receipts and offers to attach later.
    const code = (diem?.detail as { code?: string } | undefined)?.code;
    if (diem?.status === 503 && code?.startsWith('evidence_storage')) {
        return NextResponse.json(
            { error: code, message: 'No pudimos guardar el comprobante en este momento.' },
            { status: 503 },
        );
    }
    console.error(`[wallet-topups] ${logContext}`, error);
    return NextResponse.json(
        { error: 'TOPUP_UNAVAILABLE', message: 'Las recargas no están disponibles en este momento.' },
        { status: 503 },
    );
}

export type CompanyScope =
    | { ok: true; companyId: string }
    | { ok: false; response: NextResponse };

export function companyOrForbidden(user: { companyId: string | null }): CompanyScope {
    if (user.companyId) return { ok: true, companyId: user.companyId };
    return {
        ok: false,
        response: NextResponse.json(
            { error: 'FORBIDDEN', message: 'Usuario sin compañía asignada' },
            { status: 403 },
        ),
    };
}

export type EvidenceFormResult =
    | { ok: true; files: EvidenceUpload[] }
    | { ok: false; response: NextResponse };

function invalidEvidence(message: string, status = 400): EvidenceFormResult {
    return { ok: false, response: NextResponse.json({ error: 'INVALID_EVIDENCE', message }, { status }) };
}

/**
 * Receipts in a multipart form (`files`), checked before anything reaches
 * DevDiem: count, size and type read from the bytes (not the name).
 */
export async function evidenceFromForm(form: FormData): Promise<EvidenceFormResult> {
    const entries = form.getAll('files').filter((entry): entry is File => typeof entry !== 'string');
    if (entries.length > EVIDENCE_MAX_FILES) {
        return invalidEvidence(`Puedes adjuntar hasta ${EVIDENCE_MAX_FILES} comprobantes.`);
    }
    const files: EvidenceUpload[] = [];
    for (const file of entries) {
        const name = file.name || 'comprobante';
        const sizeError = evidenceSizeError({ name, size: file.size });
        if (sizeError) return invalidEvidence(sizeError, file.size > 0 ? 413 : 400);
        const head = new Uint8Array(await file.slice(0, 64).arrayBuffer());
        if (!sniffEvidenceType(head)) {
            return invalidEvidence(`${name}: debe ser una foto (JPG, PNG, WebP, HEIC) o un PDF.`, 415);
        }
        files.push({ name, data: file });
    }
    return { ok: true, files };
}
