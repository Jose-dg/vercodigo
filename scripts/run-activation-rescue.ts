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

import { processActivationJob } from '../src/services/self-service/activate-card.service';

const JOB_IDS = process.argv.slice(2);
if (!JOB_IDS.length) {
    console.error('Usage: npx tsx scripts/run-activation-rescue.ts <jobId> [...]');
    process.exit(1);
}

async function main() {
    for (const id of JOB_IDS) {
        try {
            const result = await processActivationJob(id);
            console.log(id, JSON.stringify(result));
        } catch (error) {
            console.error(id, error instanceof Error ? error.message : error);
            process.exitCode = 1;
        }
    }
}

main();
