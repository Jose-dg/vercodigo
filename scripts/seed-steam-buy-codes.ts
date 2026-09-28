/**
 * Idempotent reconciliation for Steam wallet SKUs in Buy Codes (diem-sas).
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/seed-steam-buy-codes.ts
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/seed-steam-buy-codes.ts --apply
 *
 * Dry-run is the default. Requires DATABASE_URL and loads .env.local if present.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { Prisma, PrismaClient } from "@prisma/client";

import {
    RETIRED_STEAM_SKUS,
    STEAM_CATALOG,
    type SteamProductSpec,
} from "../src/lib/catalog/steam";

const envPath = resolve(process.cwd(), ".env.local");
try {
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const idx = trimmed.indexOf("=");
        if (idx === -1) continue;
        const key = trimmed.slice(0, idx);
        let value = trimmed.slice(idx + 1);
        if (
            (value.startsWith('"') && value.endsWith('"'))
            || (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        process.env[key] = value;
    }
} catch {
    // Rely on existing process.env.
}

const prisma = new PrismaClient();
const COP_PER_USD = 3600;

type ReconciliationAction = {
    action: "create" | "update" | "unchanged" | "retire" | "missing";
    sku: string;
    name?: string;
};

function expectedCost(spec: SteamProductSpec): number {
    return spec.cost ?? (spec.currency === "USD" ? spec.amount * COP_PER_USD : spec.amount);
}

async function planReconciliation(): Promise<ReconciliationAction[]> {
    const rows = await prisma.product.findMany({
        where: {
            sku: { in: [...STEAM_CATALOG.map((spec) => spec.sku), ...RETIRED_STEAM_SKUS] },
        },
        include: { denominations: true, costs: true },
    });
    const bySku = new Map(rows.map((row) => [row.sku, row]));

    const actions: ReconciliationAction[] = STEAM_CATALOG.map((spec) => {
        const product = bySku.get(spec.sku);
        if (!product) return { action: "create", sku: spec.sku, name: spec.name };

        const denomination = product.denominations.find(
            (row) => row.devDiemProductId === spec.devDiemProductId,
        ) ?? product.denominations.find((row) => row.amount === spec.amount);
        const cost = denomination
            ? product.costs.find((row) => (
                row.companyId === null && row.denominationId === denomination.id
            ))
            : undefined;
        const needsUpdate = product.name !== spec.name
            || product.brand !== "Steam"
            || product.category !== "Gift Card Digital"
            || !product.isActive
            || !product.isGiftCard
            || product.devDiemProductId !== null
            || !denomination
            || denomination.amount !== spec.amount
            || denomination.currency !== spec.currency
            || denomination.devDiemProductId !== spec.devDiemProductId
            || !cost
            || cost.cost !== expectedCost(spec)
            || cost.currency !== "COP"
            || !cost.isActive;
        return { action: needsUpdate ? "update" : "unchanged", sku: spec.sku, name: spec.name };
    });

    for (const sku of RETIRED_STEAM_SKUS) {
        const product = bySku.get(sku);
        if (!product) {
            actions.push({ action: "missing", sku });
            continue;
        }
        const hasActiveCost = product.costs.some((cost) => cost.isActive);
        actions.push({
            action: product.isActive || hasActiveCost ? "retire" : "unchanged",
            sku,
            name: product.name,
        });
    }
    return actions;
}

async function upsertGlobalCost(
    tx: Prisma.TransactionClient,
    params: {
        productId: string;
        denominationId: string;
        cost: number;
    },
) {
    const existing = await tx.productCost.findFirst({
        where: {
            companyId: null,
            productId: params.productId,
            denominationId: params.denominationId,
        },
        orderBy: { createdAt: "asc" },
    });
    if (existing) {
        await tx.productCost.update({
            where: { id: existing.id },
            data: { cost: params.cost, currency: "COP", isActive: true },
        });
        return;
    }
    await tx.productCost.create({
        data: {
            companyId: null,
            productId: params.productId,
            denominationId: params.denominationId,
            cost: params.cost,
            currency: "COP",
            isActive: true,
        },
    });
}

async function upsertProduct(tx: Prisma.TransactionClient, spec: SteamProductSpec) {
    const product = await tx.product.upsert({
        where: { sku: spec.sku },
        update: {
            name: spec.name,
            brand: "Steam",
            category: "Gift Card Digital",
            isActive: true,
            isGiftCard: true,
            devDiemProductId: null,
        },
        create: {
            name: spec.name,
            sku: spec.sku,
            brand: "Steam",
            category: "Gift Card Digital",
            isActive: true,
            isGiftCard: true,
        },
    });

    const byRemote = await tx.productDenomination.findFirst({
        where: { devDiemProductId: spec.devDiemProductId },
    });
    const denomination = byRemote
        ? await tx.productDenomination.update({
            where: { id: byRemote.id },
            data: {
                productId: product.id,
                amount: spec.amount,
                currency: spec.currency,
                devDiemProductId: spec.devDiemProductId,
            },
        })
        : await tx.productDenomination.upsert({
            where: { productId_amount: { productId: product.id, amount: spec.amount } },
            update: { currency: spec.currency, devDiemProductId: spec.devDiemProductId },
            create: {
                productId: product.id,
                amount: spec.amount,
                currency: spec.currency,
                devDiemProductId: spec.devDiemProductId,
            },
        });

    await upsertGlobalCost(tx, {
        productId: product.id,
        denominationId: denomination.id,
        cost: expectedCost(spec),
    });
}

async function applyReconciliation() {
    await prisma.$transaction(
        async (tx) => {
            for (const spec of STEAM_CATALOG) {
                await upsertProduct(tx, spec);
            }
            for (const sku of RETIRED_STEAM_SKUS) {
                const product = await tx.product.findUnique({ where: { sku } });
                if (!product) continue;
                await tx.product.update({ where: { id: product.id }, data: { isActive: false } });
                await tx.productCost.updateMany({
                    where: { productId: product.id, isActive: true },
                    data: { isActive: false },
                });
            }
        },
        { maxWait: 10_000, timeout: 30_000 },
    );
}

async function main() {
    const before = await planReconciliation();
    if (!process.argv.includes("--apply")) {
        console.log(JSON.stringify({ apply: false, actions: before }, null, 2));
        console.log("No database changes were made. Re-run with --apply after reviewing the plan.");
        return;
    }

    await applyReconciliation();
    const after = await planReconciliation();
    console.log(JSON.stringify({ apply: true, actions: before, verification: after }, null, 2));
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
