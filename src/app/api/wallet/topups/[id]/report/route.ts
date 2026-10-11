import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { withAuth } from '@/lib/auth/guard';
import type { AuthenticatedActor } from '@/lib/auth/actor';
import { reportTopUp, type EvidenceUpload } from '@/lib/devdiem/stored-value';
import { companyOrForbidden, evidenceFromForm, topUpErrorResponse } from '@/lib/wallet/topup-api';

const reportSchema = z.object({
    bankReference: z.string().trim().min(3).max(200),
});

type ReportInput = { ok: true; bankReference: string; files: EvidenceUpload[] } | { ok: false; response: NextResponse };

function invalidReference(): ReportInput {
    return {
        ok: false,
        response: NextResponse.json(
            { error: 'INVALID', message: 'Escribe la referencia que te dio tu banco.' },
            { status: 400 },
        ),
    };
}

/** JSON `{ bankReference }`, or multipart with `bankReference` and up to 3 `files`. */
async function readReport(req: NextRequest): Promise<ReportInput> {
    if (!(req.headers.get('content-type') ?? '').startsWith('multipart/form-data')) {
        const parsed = reportSchema.safeParse(await req.json().catch(() => null));
        return parsed.success
            ? { ok: true, bankReference: parsed.data.bankReference, files: [] }
            : invalidReference();
    }
    const form = await req.formData().catch(() => null);
    if (!form) return invalidReference();
    const parsed = reportSchema.safeParse({ bankReference: form.get('bankReference') });
    if (!parsed.success) return invalidReference();
    const evidence = await evidenceFromForm(form);
    if (!evidence.ok) return evidence;
    return { ok: true, bankReference: parsed.data.bankReference, files: evidence.files };
}

/** POST /api/wallet/topups/:id/report — "ya pagué" with the bank reference and optional receipts. */
async function handler(
    req: NextRequest,
    context: { params: Promise<{ id: string }> },
    _ability: unknown,
    user: AuthenticatedActor,
) {
    const scope = companyOrForbidden(user);
    if (!scope.ok) return scope.response;
    const { companyId } = scope;
    const input = await readReport(req);
    if (!input.ok) return input.response;
    const { id } = await context.params;
    try {
        return NextResponse.json({ topUp: await reportTopUp(companyId, id, input.bankReference, input.files) });
    } catch (error) {
        return topUpErrorResponse(error, 'report');
    }
}

export const POST = withAuth('create', 'WalletTopUp', handler);
