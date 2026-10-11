import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { withAuth } from '@/lib/auth/guard';
import type { AuthenticatedActor } from '@/lib/auth/actor';
import { reportTopUp } from '@/lib/devdiem/stored-value';
import { companyOrForbidden, topUpErrorResponse } from '@/lib/wallet/topup-api';

const reportSchema = z.object({
    bankReference: z.string().trim().min(3).max(200),
});

/** POST /api/wallet/topups/:id/report — "ya pagué" with the bank reference. */
async function handler(
    req: NextRequest,
    context: { params: Promise<{ id: string }> },
    _ability: unknown,
    user: AuthenticatedActor,
) {
    const scope = companyOrForbidden(user);
    if (!scope.ok) return scope.response;
    const { companyId } = scope;
    const parsed = reportSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json(
            { error: 'INVALID', message: 'Escribe la referencia que te dio tu banco.' },
            { status: 400 },
        );
    }
    const { id } = await context.params;
    try {
        return NextResponse.json({ topUp: await reportTopUp(companyId, id, parsed.data.bankReference) });
    } catch (error) {
        return topUpErrorResponse(error, 'report');
    }
}

export const POST = withAuth('create', 'WalletTopUp', handler);
