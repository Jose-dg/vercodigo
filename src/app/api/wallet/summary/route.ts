import { NextRequest, NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/guard';
import type { AuthenticatedActor } from '@/lib/auth/actor';
import { listTopUps } from '@/lib/devdiem/stored-value';
import { companyOrForbidden } from '@/lib/wallet/topup-api';
import { openTopUpsTotal, topUpStatePresentation } from '@/lib/wallet/topups';
import { creditTopUp, topUpsEnabled } from '@/services/wallet/gateway-topup.service';
import { getOrCreateWallet } from '@/services/wallet/wallet.service';

/**
 * GET /api/wallet/summary — balance for the top bar plus top-ups in flight.
 * Self-heals: a top-up DevDiem reports as credited but not yet recorded gets
 * its wallet entry here. If DevDiem is unreachable the balance still shows.
 */
async function handler(_req: NextRequest, _ctx: unknown, _ability: unknown, user: AuthenticatedActor) {
    const scope = companyOrForbidden(user);
    if (!scope.ok) return scope.response;
    const { companyId } = scope;

    let openTopUps: { count: number; total: number } | null = null;
    // The UI offers top-ups only when they can complete: enabled in SystemConfig
    // and answered by DevDiem. Otherwise the button stays hidden (no dead action).
    let topUpsAvailable = false;
    if (await topUpsEnabled()) {
        try {
            const topUps = await listTopUps(companyId);
            topUpsAvailable = true;
            for (const topUp of topUps) {
                if (topUp.state === 'credited' && !topUp.partner_acknowledged_at) {
                    await creditTopUp(companyId, topUp, user.id);
                }
            }
            openTopUps = {
                count: topUps.filter((topUp) => topUpStatePresentation(topUp.state).isOpen).length,
                total: openTopUpsTotal(topUps),
            };
        } catch (error) {
            console.error('[wallet/summary] DevDiem top-ups unavailable', error);
        }
    }
    const wallet = await getOrCreateWallet(companyId);
    return NextResponse.json({
        currency: wallet.currency,
        balance: wallet.balance,
        openTopUps,
        topUpsAvailable,
    });
}

export const GET = withAuth('read', 'Wallet', handler);
