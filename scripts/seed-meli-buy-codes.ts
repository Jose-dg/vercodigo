/**
 * Idempotent seed for Mercado Libre Colombia gift cards in Buy Codes.
 * One SAS Product (MELI-GC-CO) with two COP denoms, each mapped to a Diem UUID.
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/seed-meli-buy-codes.ts
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/seed-meli-buy-codes.ts --apply
 *
 * Requires DATABASE_URL (loads .env.local if present).
 * Prerequisite: Diem `provision_colombia_gift_cards --apply` so
 * StoreProduct.fulfillment_enabled=True for these UUIDs (no PINs are loaded).
 *
 * Verify:
 *   GET {DIEM_API}/api/v1/catalog/products/?store_id={DIEM_STORE_ID}&fulfillment_enabled=true
 *     must include MELI-GC-CO-100000 and MELI-GC-CO-50000
 *   GET /api/products?purchasable=true  → Mercado Libre under región CO
 *   /ops/diem filter “Fulfillment on” → no missing_source
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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
    // Rely on existing process.env
}

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type DenomSpec = {
    amount: number;
    currency: "COP";
    devDiemProductId: string;
    cost: number;
};

type ProductSpec = {
    name: string;
    sku: string;
    brand: string;
    category: string;
    denominations: DenomSpec[];
};

const CATALOG: ProductSpec[] = [
    {
        name: "Mercado Libre Gift Card Colombia",
        sku: "MELI-GC-CO",
        brand: "Mercado Libre",
        category: "Gift Card Digital",
        denominations: [
            {
                amount: 100000,
                currency: "COP",
                // uuid5 from provision_colombia_gift_cards
                devDiemProductId: "7e96f84c-e67c-539c-98bd-dc2ce5e35167",
                cost: 100000,
            },
            {
                amount: 50000,
                currency: "COP",
                devDiemProductId: "874f07a2-8fb6-5920-a66c-4b869f2fbb26",
                cost: 50000,
            },
        ],
    },
];

async function upsertGlobalCost(params: {
    productId: string;
    denominationId: string;
    cost: number;
    currency: string;
}) {
    const existing = await prisma.productCost.findFirst({
        where: {
            companyId: null,
            productId: params.productId,
            denominationId: params.denominationId,
        },
    });
    if (existing) {
        await prisma.productCost.update({
            where: { id: existing.id },
            data: {
                cost: params.cost,
                currency: params.currency,
                isActive: true,
            },
        });
        return;
    }
    await prisma.productCost.create({
        data: {
            companyId: null,
            productId: params.productId,
            denominationId: params.denominationId,
            cost: params.cost,
            currency: params.currency,
            isActive: true,
        },
    });
}

async function upsertProduct(spec: ProductSpec) {
    const product = await prisma.product.upsert({
        where: { sku: spec.sku },
        update: {
            name: spec.name,
            brand: spec.brand,
            category: spec.category,
            isActive: true,
            isGiftCard: true,
            devDiemProductId: null,
        },
        create: {
            name: spec.name,
            sku: spec.sku,
            brand: spec.brand,
            category: spec.category,
            isActive: true,
            isGiftCard: true,
        },
    });

    for (const denom of spec.denominations) {
        const byRemote = await prisma.productDenomination.findFirst({
            where: { devDiemProductId: denom.devDiemProductId },
        });
        let denomination;
        if (byRemote) {
            denomination = await prisma.productDenomination.update({
                where: { id: byRemote.id },
                data: {
                    productId: product.id,
                    amount: denom.amount,
                    currency: denom.currency,
                    devDiemProductId: denom.devDiemProductId,
                },
            });
        } else {
            denomination = await prisma.productDenomination.upsert({
                where: {
                    productId_amount: {
                        productId: product.id,
                        amount: denom.amount,
                    },
                },
                update: {
                    currency: denom.currency,
                    devDiemProductId: denom.devDiemProductId,
                },
                create: {
                    productId: product.id,
                    amount: denom.amount,
                    currency: denom.currency,
                    devDiemProductId: denom.devDiemProductId,
                },
            });
        }

        await upsertGlobalCost({
            productId: product.id,
            denominationId: denomination.id,
            cost: denom.cost,
            currency: denom.currency,
        });
    }

    return product;
}

async function main() {
    if (!process.argv.includes("--apply")) {
        console.log(
            `PLAN: ${CATALOG.length} Mercado Libre product(s) would be upserted `
            + `(${CATALOG[0].denominations.length} denom(s)).`,
        );
        console.log("No database changes were made. Re-run with --apply after verifying DATABASE_URL.");
        return;
    }
    console.log(`Seeding ${CATALOG.length} Mercado Libre Buy Codes product(s)...`);
    for (const spec of CATALOG) {
        const product = await upsertProduct(spec);
        console.log(
            `✓ ${product.name} (${product.sku}) — ${spec.denominations.length} denom(s)`,
        );
    }
    console.log("Done.");
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
