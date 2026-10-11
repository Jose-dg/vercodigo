import { NextRequest, NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/guard';
import type { AuthenticatedActor } from '@/lib/auth/actor';
import { companyOrForbidden, topUpErrorResponse } from '@/lib/wallet/topup-api';
import { syncTopUp } from '@/services/wallet/gateway-topup.service';

/** GET /api/wallet/topups/:id — current state; credits the wallet once credited. */
async function handler(
    _req: NextRequest,
    context: { params: Promise<{ id: string }> },
    _ability: unknown,
    user: AuthenticatedActor,
) {
    const scope = companyOrForbidden(user);
    if (!scope.ok) return scope.response;
    const { companyId } = scope;
    const { id } = await context.params;
    try {
        return NextResponse.json({ topUp: await syncTopUp(companyId, id, user.id) });
    } catch (error) {
        return topUpErrorResponse(error, 'detail');
    }
}

export const GET = withAuth('read', 'WalletTopUp', handler);
