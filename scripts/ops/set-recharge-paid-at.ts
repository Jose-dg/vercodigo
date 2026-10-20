/**
 * Sets the payment time of a manual top-up through the same service as
 * /wallets (validation, ledger rebuild, audit). Dry run unless --apply.
 *
 *   DATABASE_URL=... npx ts-node -r tsconfig-paths/register scripts/ops/set-recharge-paid-at.ts \
 *     --reference 091020260612 --company cms92txq90000amogy81su0zd \
 *     --paid-at 2026-10-09T18:12:00-05:00 --actor-email admin@example.com \
 *     --reason "Comprobante: pago del 9/10 6:12 p. m." [--apply]
 */
import prisma from "@/lib/prisma";
import { correctRechargeTime, previewRechargeTimeCorrection } from "@/services/wallet/recharge-time-correction.service";

function arg(name: string): string {
    const i = process.argv.indexOf(`--${name}`);
    const value = i >= 0 ? process.argv[i + 1] : undefined;
    if (!value) throw new Error(`Falta --${name}`);
    return value;
}

async function main() {
    const apply = process.argv.includes("--apply");
    const paidAt = new Date(arg("paid-at"));
    const reason = arg("reason");

    const actor = await prisma.user.findUniqueOrThrow({ where: { email: arg("actor-email") }, select: { id: true, role: true } });
    if (actor.role !== "SUPER_ADMIN") throw new Error(`El actor debe ser SUPER_ADMIN (es ${actor.role})`);

    const movement = await prisma.walletTransaction.findFirstOrThrow({
        where: { externalReference: arg("reference"), type: "RECHARGE", method: "MANUAL", wallet: { companyId: arg("company") } },
    });

    const preview = await previewRechargeTimeCorrection({ transactionId: movement.id, paidAt });
    console.log(JSON.stringify({ movement: movement.id, from: movement.occurredAt, source: movement.occurredAtSource, ...preview }, null, 2));
    if (!apply) {
        console.log("Dry run: nada escrito. Repite con --apply.");
        return;
    }
    const result = await correctRechargeTime({
        transactionId: movement.id,
        paidAt,
        expectedOccurredAt: movement.occurredAt,
        reason,
        actorId: actor.id,
    });
    console.log(JSON.stringify({ changed: result.changed, occurredAt: result.transaction.occurredAt, source: result.transaction.occurredAtSource }));
}

main().finally(() => prisma.$disconnect());
