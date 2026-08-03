/**
 * E2E activation test against production DBs.
 * Usage: npx tsx scripts/e2e-activation-test.ts C5DCCVTB
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
import { activateCard, processActivationJob } from '../src/services/self-service/activate-card.service';

const TEST_USER_ID = 'cmixxhiad00092fwzu5gsb6gy'; // admin@diemsas.com SUPER_ADMIN
const MAX_POLLS = 30;
const POLL_MS = 2000;

async function sleep(ms: number) {
    await new Promise((r) => setTimeout(r, ms));
}

async function main() {
    const cardUuid = (process.argv[2] || 'C5DCCVTB').trim().toUpperCase();
    const cardBefore = await prisma.card.findUnique({
        where: { uuid: cardUuid },
        select: { isActivated: true, activationLock: true },
    });
    if (!cardBefore) throw new Error(`Tarjeta ${cardUuid} no existe`);
    if (cardBefore.isActivated) throw new Error(`Tarjeta ${cardUuid} ya está activada`);

    console.log('STEP 1 activateCard', cardUuid);
    const started = await activateCard({ qr: cardUuid, userId: TEST_USER_ID });
    console.log('activateCard result', JSON.stringify(started));

    const jobId = started.jobId;
    if (!jobId) throw new Error('Sin jobId');

    console.log('STEP 2 poll processActivationJob', jobId);
    for (let i = 0; i < MAX_POLLS; i += 1) {
        try {
            const result = await processActivationJob(jobId);
            console.log(`poll ${i + 1}`, JSON.stringify({ status: result.status }));
            if (result.status === 'COMPLETED') {
                const cardAfter = await prisma.card.findUnique({
                    where: { uuid: cardUuid },
                    include: {
                        key: { select: { code: true, status: true } },
                        activationJobs: {
                            where: { id: jobId },
                            select: { status: true, fulfillmentStatus: true, diemRequestId: true },
                        },
                    },
                });
                console.log('E2E OK', {
                    uuid: cardUuid,
                    activated: cardAfter?.isActivated,
                    lock: cardAfter?.activationLock,
                    codePrefix: cardAfter?.key?.code?.slice(0, 6),
                    job: cardAfter?.activationJobs[0],
                });
                return;
            }
            if (['FAILED', 'ACTION_REQUIRED'].includes(String(result.status))) {
                throw new Error(`Job terminó en ${result.status}`);
            }
        } catch (error) {
            const job = await prisma.activationJob.findUnique({
                where: { id: jobId },
                select: { status: true, fulfillmentStatus: true, lastError: true },
            });
            console.log(`poll ${i + 1} error`, error instanceof Error ? error.message : error, job);
        }
        await sleep(POLL_MS);
    }
    throw new Error('Timeout esperando COMPLETED');
}

main()
    .catch((error) => {
        console.error('E2E FAIL', error instanceof Error ? error.message : error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
