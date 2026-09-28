/**
 * Idempotent seed for Colombia pin / gift-card families in Buy Codes:
 * IMVU, Google Play, Uber. One SAS Product per brand, N COP denoms.
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/seed-colombia-pins-buy-codes.ts
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/seed-colombia-pins-buy-codes.ts --apply
 *
 * Requires DATABASE_URL (loads .env.local if present).
 * Prerequisite: Diem `provision_colombia_gift_cards --apply` so
 * StoreProduct.fulfillment_enabled=True for these UUIDs (no PINs are loaded).
 *
 * Verify:
 *   GET {DIEM_API}/api/v1/catalog/products/?store_id={DIEM_STORE_ID}&fulfillment_enabled=true
 *     must include IMVU-CO-*, GPLAY-CO-*, UBER-CO-*
 *   GET /api/products?purchasable=true  → IMVU / Google Play / Uber under región CO
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
        name: "Pin virtual IMVU Colombia",
        sku: "IMVU-CO",
        brand: "IMVU",
        category: "Gift Card Digital",
        denominations: [
            {
                amount: 24000,
                currency: "COP",
                devDiemProductId: "1b0d5bd6-7012-57bb-bd1b-d08abfe8872a",
                cost: 24000,
            },
            {
                amount: 48000,
                currency: "COP",
                devDiemProductId: "4278f2bd-6402-5af6-b1ea-4b5a3da3bd54",
                cost: 48000,
            },
        ],
    },
    {
        name: "Google Play Colombia",
        sku: "GPLAY-CO",
        brand: "Google Play",
        category: "Gift Card Digital",
        denominations: [
            {
                amount: 10000,
                currency: "COP",
                devDiemProductId: "9ee29aab-ac2f-5e23-8f79-87cd85158d54",
                cost: 10000,
            },
            {
                amount: 30000,
                currency: "COP",
                devDiemProductId: "6847cee6-b8fd-5cbb-b69c-1ea586aa588f",
                cost: 30000,
            },
            {
                amount: 50000,
                currency: "COP",
                devDiemProductId: "8d6f710a-1353-5b80-a3f7-74de3c2b0b7a",
                cost: 50000,
            },
        ],
    },
    {
        name: "Pin Uber Colombia",
        sku: "UBER-CO",
        brand: "Uber",
        category: "Gift Card Digital",
        denominations: [
            {
                amount: 30000,
                currency: "COP",
                devDiemProductId: "9427763b-48a8-5252-a274-3261288047b2",
                cost: 30000,
            },
            {
                amount: 50000,
                currency: "COP",
                devDiemProductId: "aff0861b-bc9b-50cd-853c-9a8c138f497e",
                cost: 50000,
            },
            {
                amount: 100000,
                currency: "COP",
                devDiemProductId: "85271fa2-73a9-5d3d-8b64-6922da80577b",
                cost: 100000,
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
    const denomCount = CATALOG.reduce((sum, spec) => sum + spec.denominations.length, 0);
    if (!process.argv.includes("--apply")) {
        console.log(
            `PLAN: ${CATALOG.length} Colombia pin product(s) would be upserted `
            + `(${denomCount} denom(s)).`,
        );
        console.log("No database changes were made. Re-run with --apply after verifying DATABASE_URL.");
        return;
    }
    console.log(`Seeding ${CATALOG.length} Colombia pin Buy Codes product(s)...`);
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
