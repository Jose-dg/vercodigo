/**
 * Rollback a test card activation in diem-sas (prod-safe manual ops).
 * Usage: npx tsx scripts/rollback-test-activation.ts STMDF3MN
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const envPath = resolve(process.cwd(), '.env.local');
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx);
    let value = trimmed.slice(idx + 1);
    if (
        (value.startsWith('"') && value.endsWith('"'))
        || (value.startsWith("'") && value.endsWith("'"))
    ) {
        value = value.slice(1, -1);
    }
    process.env[key] ??= value;
}

import prisma from '../src/lib/prisma';
import { recharge } from '../src/services/wallet/wallet.service';

const PLATFORM_ACTOR_ID = 'cmixxhiad00092fwzu5gsb6gy';

async function main() {
    const cardUuid = (process.argv[2] || '').trim().toUpperCase();
    if (!cardUuid) throw new Error('Usage: npx tsx scripts/rollback-test-activation.ts <UUID>');

    const card = await prisma.card.findUnique({
        where: { uuid: cardUuid },
        include: {
            store: true,
            key: true,
            activationJobs: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
    });
    if (!card) throw new Error(`Tarjeta ${cardUuid} no encontrada`);

    const job = card.activationJobs[0];
    const activation = await prisma.cardActivation.findFirst({
        where: { cardId: card.id },
        orderBy: { activatedAt: 'desc' },
    });
    const walletTx = activation
        ? await prisma.walletTransaction.findFirst({
            where: { cardActivationId: activation.id, type: 'CONSUMPTION' },
        })
        : null;

    await prisma.$transaction(async (tx) => {
        if (walletTx && walletTx.status === 'CONFIRMED' && walletTx.amount > 0) {
            await recharge({
                companyId: card.store.companyId,
                amount: Number(walletTx.amount),
                method: 'MANUAL',
                externalReference: `rollback-${cardUuid}`,
                description: `Reverso activacion test ${cardUuid}`,
                actorId: PLATFORM_ACTOR_ID,
            });
        }

        if (activation) {
            await tx.activationAttempt.deleteMany({ where: { cardId: card.id, success: true } });
            await tx.walletTransaction.deleteMany({ where: { cardActivationId: activation.id } });
            await tx.cardActivation.delete({ where: { id: activation.id } });
        }

        if (card.keyId) {
            await tx.key.delete({ where: { id: card.keyId } }).catch(() => undefined);
        }

        await tx.card.update({
            where: { id: card.id },
            data: {
                isActivated: false,
                activatedAt: null,
                keyId: null,
                activationLock: false,
                activationLockBy: null,
                activationLockAt: null,
            },
        });

        if (job) {
            await tx.activationJob.update({
                where: { id: job.id },
                data: {
                    status: 'FAILED',
                    fulfillmentStatus: 'cancelled',
                    deliveredCodes: [],
                    lastError: 'Rollback activacion E2E test',
                    nextRetryAt: null,
                },
            });
        }
    });

    const after = await prisma.card.findUnique({
        where: { uuid: cardUuid },
        select: { isActivated: true, keyId: true, activationLock: true },
    });
    console.log('rollback OK', cardUuid, after);
}

main()
    .catch((error) => {
        console.error('rollback FAIL', error instanceof Error ? error.message : error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
