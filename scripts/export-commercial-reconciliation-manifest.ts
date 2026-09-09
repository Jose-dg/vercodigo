import { createHash } from "crypto";
import { writeFileSync } from "fs";
import { loadEnvConfig } from "@next/env";

import prisma from "../src/lib/prisma";

loadEnvConfig(process.cwd());

const outputArg = process.argv.indexOf("--output");
if (outputArg < 0 || !process.argv[outputArg + 1]) {
    throw new Error("Uso: npm run reconciliation:export -- --output manifest.json");
}
const output = process.argv[outputArg + 1];

type ManifestEntry = {
    external_reference: string;
    idempotency_key: string;
    account_code: string;
    currency_code: string;
    lines: Array<{ product_id: string; quantity: number; unit_price: string }>;
    total_amount: string;
    wallet_reference: string;
    evidence: { status: "confirmed"; amount: string; currency_code: string };
};

async function main() {
    const purchases = await prisma.codePurchase.findMany({
        where: { diemRequestId: { not: null } },
        include: { denomination: true },
        orderBy: { createdAt: "asc" },
    });
    const purchaseProducts = await prisma.product.findMany({
        where: { id: { in: [...new Set(purchases.map((row) => row.productId))] } },
        select: { id: true, devDiemProductId: true },
    });
    const productsById = new Map(purchaseProducts.map((row) => [row.id, row]));
    const purchaseTransactions = await prisma.walletTransaction.findMany({
        where: {
            codePurchaseId: { in: purchases.map((row) => row.id) },
            type: "CONSUMPTION",
            status: "CONFIRMED",
        },
    });

    const activationJobs = await prisma.activationJob.findMany({
        where: { diemRequestId: { not: null } },
        include: {
            card: {
                include: {
                    product: true,
                    denomination: true,
                    store: true,
                    activation: true,
                },
            },
        },
        orderBy: { createdAt: "asc" },
    });
    const activationIds = activationJobs
        .map((job) => job.card.activation?.id)
        .filter((id): id is string => Boolean(id));
    const activationTransactions = await prisma.walletTransaction.findMany({
        where: {
            cardActivationId: { in: activationIds },
            type: "CONSUMPTION",
            status: "CONFIRMED",
        },
    });

    const requests: ManifestEntry[] = [];
    const review: Array<{ kind: string; id: string; reason: string }> = [];
    for (const purchase of purchases) {
        const product = productsById.get(purchase.productId);
        const devDiemProductId =
            purchase.denomination?.devDiemProductId ?? product?.devDiemProductId;
        const transactions = purchaseTransactions.filter(
            (transaction) => transaction.codePurchaseId === purchase.id,
        );
        if (!devDiemProductId || transactions.length !== 1 || purchase.count < 1) {
            review.push({
                kind: "code_purchase",
                id: purchase.id,
                reason: !devDiemProductId
                    ? "missing_devdiem_product"
                    : "wallet_transaction_not_exactly_one",
            });
            continue;
        }
        const transaction = transactions[0];
        requests.push({
            external_reference: `DIEM-SAS-PURCHASE-${purchase.id}`,
            idempotency_key: purchase.idempotencyKey,
            account_code: `diem-sas:${purchase.companyId}`,
            currency_code: purchase.currency.toUpperCase(),
            lines: [{
                product_id: devDiemProductId,
                quantity: purchase.count,
                unit_price: (purchase.totalAmount / purchase.count).toFixed(2),
            }],
            total_amount: purchase.totalAmount.toFixed(2),
            wallet_reference: transaction.id,
            evidence: {
                status: "confirmed",
                amount: transaction.amount.toFixed(2),
                currency_code: purchase.currency.toUpperCase(),
            },
        });
    }

    for (const job of activationJobs) {
        const activationId = job.card.activation?.id;
        const devDiemProductId =
            job.card.denomination?.devDiemProductId
            ?? job.card.product.devDiemProductId;
        const transactions = activationTransactions.filter(
            (transaction) => transaction.cardActivationId === activationId,
        );
        if (
            !devDiemProductId
            || !job.commercialAmount
            || !job.commercialCurrency
            || !activationId
            || transactions.length !== 1
        ) {
            review.push({
                kind: "card_activation",
                id: job.id,
                reason: "incomplete_commercial_or_wallet_evidence",
            });
            continue;
        }
        const transaction = transactions[0];
        requests.push({
            external_reference: `DIEM-SAS-ACTIVATION-${job.id}`,
            idempotency_key: job.idempotencyKey,
            account_code: `diem-sas:${job.card.store.companyId}`,
            currency_code: job.commercialCurrency.toUpperCase(),
            lines: [{
                product_id: devDiemProductId,
                quantity: 1,
                unit_price: job.commercialAmount.toFixed(2),
            }],
            total_amount: job.commercialAmount.toFixed(2),
            wallet_reference: transaction.id,
            evidence: {
                status: "confirmed",
                amount: transaction.amount.toFixed(2),
                currency_code: job.commercialCurrency.toUpperCase(),
            },
        });
    }

    const serialized = `${JSON.stringify({ requests, review }, null, 2)}\n`;
    writeFileSync(output, serialized, { encoding: "utf8", flag: "wx" });
    const digest = createHash("sha256").update(serialized).digest("hex");
    console.error(
        `manifest=${output} requests=${requests.length} review=${review.length} sha256=${digest}`,
    );
}

main()
    .catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
