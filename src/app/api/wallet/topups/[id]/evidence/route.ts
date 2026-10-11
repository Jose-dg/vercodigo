import { NextRequest, NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/guard';
import type { AuthenticatedActor } from '@/lib/auth/actor';
import { attachTopUpEvidence } from '@/lib/devdiem/stored-value';
import { companyOrForbidden, evidenceFromForm, topUpErrorResponse } from '@/lib/wallet/topup-api';

/** POST /api/wallet/topups/:id/evidence — add receipts (multipart `files`) while under review. */
async function handler(
    req: NextRequest,
    context: { params: Promise<{ id: string }> },
    _ability: unknown,
    user: AuthenticatedActor,
) {
    const scope = companyOrForbidden(user);
    if (!scope.ok) return scope.response;
    const { companyId } = scope;
    const form = await req.formData().catch(() => null);
    const evidence = form ? await evidenceFromForm(form) : null;
    if (evidence && !evidence.ok) return evidence.response;
    if (!evidence || evidence.files.length === 0) {
        return NextResponse.json(
            { error: 'INVALID_EVIDENCE', message: 'Adjunta una foto o un PDF del comprobante.' },
            { status: 400 },
        );
    }
    const { id } = await context.params;
    try {
        return NextResponse.json({ topUp: await attachTopUpEvidence(companyId, id, evidence.files) });
    } catch (error) {
        return topUpErrorResponse(error, 'evidence');
    }
}

export const POST = withAuth('create', 'WalletTopUp', handler);
