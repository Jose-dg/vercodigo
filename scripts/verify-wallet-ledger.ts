/**
 * Read-only reconciliation of every wallet against its ledger invariants.
 * Exits with code 1 and prints each finding when any invariant is broken,
 * so it can run as a scheduled job and alert.
 *
 *   npm run wallet:verify
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { PrismaClient } from "@prisma/client";
import { verifyLedger } from "../src/lib/wallet/ledger-verification";

const prisma = new PrismaClient();

async function main() {
    const [wallets, transactions, purchases, linked, failedLinked, refunds] = await Promise.all([
        prisma.wallet.findMany({ select: { id: true, companyId: true, balance: true } }),
        prisma.walletTransaction.findMany({
            select: {
                id: true,
                walletId: true,
                type: true,
                status: true,
                amount: true,
                balanceAfter: true,
                occurredAt: true,
                occurredSequence: true,
            },
        }),
        prisma.codePurchase.findMany({ select: { id: true, status: true, totalAmount: true } }),
        prisma.walletTransaction.groupBy({
            by: ["codePurchaseId"],
            where: { codePurchaseId: { not: null }, status: { not: "FAILED" } },
            _count: { _all: true },
        }),
        prisma.walletTransaction.groupBy({
            by: ["codePurchaseId"],
            where: { codePurchaseId: { not: null }, status: "FAILED" },
            _count: { _all: true },
        }),
        prisma.walletTransaction.findMany({
            where: {
                type: "REFUND",
                status: { not: "FAILED" },
                reversalOf: { codePurchaseId: { not: null } },
            },
            select: { reversalOf: { select: { codePurchaseId: true } } },
        }),
    ]);
    const reversalsByPurchase = new Map<string, number>();
    for (const refund of refunds) {
        const purchaseId = refund.reversalOf?.codePurchaseId;
        if (purchaseId) reversalsByPurchase.set(purchaseId, (reversalsByPurchase.get(purchaseId) ?? 0) + 1);
    }
    const consumptionsByPurchase = new Map(linked.map((row) => [row.codePurchaseId, row._count._all]));
    const failedByPurchase = new Map(failedLinked.map((row) => [row.codePurchaseId, row._count._all]));
    const { findings, exclusions } = verifyLedger(
        wallets.map((wallet) => ({
            ...wallet,
            rows: transactions.filter((row) => row.walletId === wallet.id),
        })),
        purchases.map((purchase) => ({
            ...purchase,
            activeConsumptions: consumptionsByPurchase.get(purchase.id) ?? 0,
            failedConsumptions: failedByPurchase.get(purchase.id) ?? 0,
            reversals: reversalsByPurchase.get(purchase.id) ?? 0,
        })),
    );
    console.log(JSON.stringify({
        wallets: wallets.length,
        purchases: purchases.length,
        reconciledExclusions: exclusions,
        findings,
    }, null, 2));
    if (findings.length) {
        console.error(`LEDGER INVARIANTS BROKEN: ${findings.length} hallazgo(s).`);
        process.exitCode = 1;
    } else {
        console.log("LEDGER OK: saldos, balanceAfter y un consumo por compra completada.");
    }
}

main()
    .catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
