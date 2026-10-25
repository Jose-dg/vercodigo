import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCodeRequest } from "@/lib/devdiem/fulfillment";
import {
    previewReversedCardReset,
    resetReversedCard,
} from "@/services/self-service/reset-reversed-card.service";

function arg(name: string): string {
    const index = process.argv.indexOf(`--${name}`);
    const value = index >= 0 ? process.argv[index + 1] : undefined;
    if (!value) throw new Error(`Falta --${name}`);
    return value;
}

async function main() {
    const apply = process.argv.includes("--apply");
    const cardUuid = arg("card-uuid").trim().toUpperCase();
    const rows = await prisma.$queryRaw<Array<{ current_database: string; pg_is_in_recovery: boolean }>>(
        Prisma.sql`SELECT current_database(), pg_is_in_recovery()`,
    );
    if (rows[0]?.current_database !== arg("expected-database") || rows[0]?.pg_is_in_recovery) {
        throw new Error(`Base no válida: ${JSON.stringify(rows[0])}`);
    }
    const actor = await prisma.user.findUniqueOrThrow({
        where: { email: arg("actor-email") },
        select: { id: true, role: true },
    });
    if (!["SUPER_ADMIN", "SYSTEM_ADMIN"].includes(actor.role)) {
        throw new Error(`El actor debe ser administrador de plataforma (es ${actor.role})`);
    }
    const params = {
        cardUuid,
        expectedJobId: arg("expected-job-id"),
        expectedRequestId: arg("expected-request-id"),
        expectedColombiaPurchaseId: arg("expected-colombia-purchase-id"),
        actorId: actor.id,
        reason: arg("reason"),
    };
    const preview = await previewReversedCardReset(params);
    const remote = await getCodeRequest(params.expectedRequestId);
    if (remote.status !== "cancelled") throw new Error("Diem no confirma la cancelación USA");

    console.log(JSON.stringify({
        database: rows[0].current_database,
        cardUuid,
        product: preview.card.product.name,
        denomination: preview.card.denomination?.amount,
        region: preview.card.denomination?.countryRegion,
        oldJobStatus: preview.job.status,
        oldRequestStatus: remote.status,
        sourceRefund: preview.refund.id,
        preservedColombiaPurchase: preview.colombiaPurchase.id,
        preservedColombiaCharge: preview.colombiaCharge.id,
        preservedColombiaAmount: preview.colombiaCharge.amount,
        archiveUuid: preview.archiveUuid,
        apply,
    }, null, 2));
    if (!apply) {
        console.log("Dry run: nada escrito.");
        return;
    }
    const expectedConfirmation = `RESET-${cardUuid}-NO-CODE`;
    if (arg("confirmation") !== expectedConfirmation) {
        throw new Error(`--confirmation debe ser ${expectedConfirmation}`);
    }
    const result = await resetReversedCard(params);
    console.log(JSON.stringify({
        archivedCard: result.archived.uuid,
        reusableCard: result.reset.uuid,
        isActivated: result.reset.isActivated,
        keyId: result.reset.keyId,
        scanCount: result.reset.scanCount,
    }));
}

main().finally(() => prisma.$disconnect());
