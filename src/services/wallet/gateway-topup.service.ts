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

import prisma from '@/lib/prisma';
import {
    acknowledgeTopUp,
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
        try {
            entry = await recharge({
                companyId,
                amount: Number(topUp.amount),
                method: 'BRE_B',
                gatewayTransactionId: topUp.id,
                externalReference: shortTopUpReference(topUp.id),
                description: `Recarga Bre-B ${shortTopUpReference(topUp.id)}`,
                actorId,
            });
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
 * Recovery for the cron job: every credited top-up DevDiem still sees as not
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
