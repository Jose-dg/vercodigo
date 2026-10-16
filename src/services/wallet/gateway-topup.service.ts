/**
 * Credits the company wallet for top-ups that DevDiem reports as credited.
 *
 * DevDiem owns the collection (who paid, review, confirmation); this service
 * owns only the wallet entry. It is idempotent: the unique
 * WalletTransaction.gatewayTransactionId makes a second credit of the same
 * top-up impossible, and the acknowledgement tells DevDiem the entry exists
 * (DevDiem reports any credited top-up left unacknowledged).
 */
import { Prisma } from '@prisma/client';

import { companyIdFromCommercialAccountCode } from '@/lib/devdiem/fulfillment';
import prisma from '@/lib/prisma';
import {
    acknowledgeTopUp,
    getStoredValueConfig,
    getTopUp,
    listTopUps,
    type TopUp,
} from '@/lib/devdiem/stored-value';
import { shortTopUpReference } from '@/lib/wallet/topups';

import { recharge } from './wallet.service';

async function findCredit(topUpId: string) {
    return prisma.walletTransaction.findUnique({ where: { gatewayTransactionId: topUpId } });
}

/** Records the wallet entry for one credited top-up and acknowledges it. */
export async function creditTopUp(companyId: string, topUp: TopUp, actorId?: string) {
    if (topUp.state !== 'credited') return null;
    let entry = await findCredit(topUp.id);
    if (!entry) {
        // The movement takes the time DevDiem confirmed the payment. Without it
        // the credit waits for the next sync instead of using the current time.
        const confirmedAt = topUp.credited_at ? new Date(topUp.credited_at) : null;
        if (!confirmedAt || Number.isNaN(confirmedAt.getTime())) {
            throw new Error(`DevDiem reportó la recarga ${topUp.id} acreditada sin credited_at`);
        }
        try {
            ({ transaction: entry } = await recharge({
                companyId,
                amount: Number(topUp.amount),
                occurredAt: confirmedAt,
                occurredAtSource: 'GATEWAY_CONFIRMATION',
                method: 'BRE_B',
                gatewayTransactionId: topUp.id,
                externalReference: shortTopUpReference(topUp.id),
                description: `Recarga Bre-B ${shortTopUpReference(topUp.id)}`,
                actorId,
            }));
        } catch (error) {
            // A concurrent sync credited it first: the unique index kept one entry.
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                entry = await findCredit(topUp.id);
            } else {
                throw error;
            }
        }
    }
    if (entry && !topUp.partner_acknowledged_at) {
        await acknowledgeTopUp(companyId, topUp.id, entry.id);
    }
    return entry;
}

/** Reads one top-up from DevDiem and credits it if it became credited. */
export async function syncTopUp(companyId: string, topUpId: string, actorId?: string): Promise<TopUp> {
    const topUp = await getTopUp(companyId, topUpId);
    await creditTopUp(companyId, topUp, actorId);
    return topUp;
}

/**
 * Recovery: every credited top-up DevDiem still sees as not
 * acknowledged gets its wallet entry (or just the acknowledgement).
 */
export async function syncPendingCredits(companyIds: string[]) {
    const stats = { companies: 0, credited: 0, errors: 0 };
    for (const companyId of companyIds) {
        stats.companies += 1;
        try {
            for (const topUp of await listTopUps(companyId, { pendingCredit: true })) {
                await creditTopUp(companyId, topUp);
                stats.credited += 1;
            }
        } catch (error) {
            stats.errors += 1;
            console.error('[wallet-topups] sync failed for company', companyId, error);
        }
    }
    return stats;
}

function topUpsConfigured(): boolean {
    try {
        getStoredValueConfig();
        return true;
    } catch {
        return false;
    }
}

/**
 * Records every top-up DevDiem already credited for the company before a
 * statement closes its period. false when they could not be verified; true
 * when top-ups are not configured for this deployment (nothing can be pending).
 */
export async function syncCreditedTopUpsBeforeClosing(companyId: string): Promise<boolean> {
    if (!topUpsConfigured()) return true;
    const stats = await syncPendingCredits([companyId]);
    return stats.errors === 0;
}

export type TopUpStateWebhook = {
    event_id: string;
    type: 'topup.state_changed';
    topup_id: string;
    account_code: string;
    state: string;
};

export function parseTopUpStateWebhook(body: unknown): TopUpStateWebhook | null {
    if (!body || typeof body !== 'object') return null;
    const row = body as Record<string, unknown>;
    if (
        row.type !== 'topup.state_changed'
        || typeof row.event_id !== 'string'
        || typeof row.topup_id !== 'string'
        || typeof row.account_code !== 'string'
        || typeof row.state !== 'string'
    ) {
        return null;
    }
    return row as TopUpStateWebhook;
}

/**
 * DevDiem says a top-up was decided. The hint is never trusted for money: the
 * top-up is re-read from DevDiem and credited through the same idempotent
 * path as the sync job, so a replayed or forged-but-signed event cannot
 * credit anything DevDiem does not report as credited.
 */
export async function handleTopUpStateWebhook(event: TopUpStateWebhook) {
    const companyId = companyIdFromCommercialAccountCode(event.account_code);
    if (!companyId) return { ok: false as const, reason: 'unknown_account' };
    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
    if (!company) return { ok: false as const, reason: 'unknown_company' };
    const topUp = await syncTopUp(company.id, event.topup_id);
    return { ok: true as const, state: topUp.state };
}
