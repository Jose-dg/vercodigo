import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCodeRequest } from "@/lib/devdiem/fulfillment";
import { reverseCancelledActivation } from "@/services/self-service/post-delivery.service";

function arg(name: string): string {
    const index = process.argv.indexOf(`--${name}`);
    const value = index >= 0 ? process.argv[index + 1] : undefined;
    if (!value) throw new Error(`Falta --${name}`);
    return value;
}

async function main() {
    const apply = process.argv.includes("--apply");
    const jobId = arg("job-id");
    const expectedDatabase = arg("expected-database");
    const rows = await prisma.$queryRaw<Array<{ current_database: string; pg_is_in_recovery: boolean }>>(
        Prisma.sql`SELECT current_database(), pg_is_in_recovery()`,
    );
    if (rows[0]?.current_database !== expectedDatabase || rows[0]?.pg_is_in_recovery) {
        throw new Error(`Base no válida: ${JSON.stringify(rows[0])}`);
    }
    const job = await prisma.activationJob.findUniqueOrThrow({ where: { id: jobId } });
    if (!job.diemRequestId) throw new Error("El job no tiene solicitud Diem");
    const remote = await getCodeRequest(job.diemRequestId);
    console.log(JSON.stringify({
        database: rows[0].current_database,
        jobId,
        localStatus: job.status,
        localFulfillmentStatus: job.fulfillmentStatus,
        remoteStatus: remote.status,
        apply,
    }, null, 2));
    if (remote.status !== "cancelled") throw new Error("Diem todavía no confirma cancelled");
    if (!apply) {
        console.log("Dry run: nada escrito.");
        return;
    }
    const expectedConfirmation = `REVERSE-${jobId}`;
    if (arg("confirmation") !== expectedConfirmation) {
        throw new Error(`--confirmation debe ser ${expectedConfirmation}`);
    }
    const result = await reverseCancelledActivation(jobId);
    console.log(JSON.stringify(result));
}

main().finally(() => prisma.$disconnect());
