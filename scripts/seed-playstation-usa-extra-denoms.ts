/**
 * Idempotent seed for extra PlayStation USA denoms in Buy Codes:
 * US$1, $2, $3, $5 (cost only), $20, $75, $150, $250.
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/seed-playstation-usa-extra-denoms.ts
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/seed-playstation-usa-extra-denoms.ts --apply
 *
 * Requires DATABASE_URL (loads .env.local if present).
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

const COP_PER_USD = 3600;

type ProductSpec = {
    name: string;
    sku: string;
    amount: number;
    devDiemProductId: string;
};

const CATALOG: ProductSpec[] = [
    {
        name: "PlayStation Gift Card US$1 — USA",
        sku: "7993664967899",
        amount: 1,
        devDiemProductId: "046e0ec2-2753-47de-a285-88ce78023c8f",
    },
    {
        name: "PlayStation Gift Card US$2 — USA",
        sku: "76750251406",
        amount: 2,
        devDiemProductId: "e2a59b89-13da-4200-9829-ae7d32409666",
    },
    {
        name: "PlayStation Gift Card US$3 — USA",
        sku: "79936649333",
        amount: 3,
        devDiemProductId: "69a04630-4962-4484-a0cf-43ae5e510a8e",
    },
    {
        name: "PlayStation Gift Card US$5 — USA",
        sku: "7993664967896",
        amount: 5,
        devDiemProductId: "4dca9f32-f9f0-4711-a877-9a56dc476708",
    },
    {
        name: "PlayStation Gift Card US$20 — USA",
        sku: "9147537940220",
        amount: 20,
        devDiemProductId: "756fc4cd-f82d-44e7-a307-a404a4dd9ad9",
    },
    {
        name: "PlayStation Gift Card US$75 — USA",
        sku: "799366870005",
        amount: 75,
        devDiemProductId: "d8842fac-5e08-473a-aaca-be82bdac60db",
    },
    {
        name: "PlayStation Gift Card US$150 — USA",
        sku: "799366084320",
        amount: 150,
        devDiemProductId: "1939e56f-856c-4048-bc64-623df164f12f",
    },
    {
        name: "PlayStation Gift Card US$250 — USA",
        sku: "0243444345",
        amount: 250,
        devDiemProductId: "2bfdd97a-2d3d-4f9e-af78-68f5d86b2034",
    },
];

async function upsertGlobalCost(params: {
    productId: string;
    denominationId: string;
    cost: number;
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
                currency: "COP",
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
            currency: "COP",
            isActive: true,
        },
    });
}

async function upsertProduct(spec: ProductSpec) {
    const product = await prisma.product.upsert({
        where: { sku: spec.sku },
        update: {
            name: spec.name,
            brand: "PlayStation",
            category: "Gift Card Digital",
            isActive: true,
            isGiftCard: true,
            devDiemProductId: null,
        },
        create: {
            name: spec.name,
            sku: spec.sku,
            brand: "PlayStation",
            category: "Gift Card Digital",
            isActive: true,
            isGiftCard: true,
        },
    });

    const byRemote = await prisma.productDenomination.findFirst({
        where: { devDiemProductId: spec.devDiemProductId },
    });
    let denomination;
    if (byRemote) {
        denomination = await prisma.productDenomination.update({
            where: { id: byRemote.id },
            data: {
                productId: product.id,
                amount: spec.amount,
                currency: "USD",
                devDiemProductId: spec.devDiemProductId,
            },
        });
    } else {
        denomination = await prisma.productDenomination.upsert({
            where: {
                productId_amount: {
                    productId: product.id,
                    amount: spec.amount,
                },
            },
            update: {
                currency: "USD",
                devDiemProductId: spec.devDiemProductId,
            },
            create: {
                productId: product.id,
                amount: spec.amount,
                currency: "USD",
                devDiemProductId: spec.devDiemProductId,
            },
        });
    }

    const cost = spec.amount * COP_PER_USD;
    await upsertGlobalCost({
        productId: product.id,
        denominationId: denomination.id,
        cost,
    });

    return { product, cost };
}

async function main() {
    if (!process.argv.includes("--apply")) {
        console.log(`PLAN: ${CATALOG.length} PlayStation USA denominations would be upserted at the configured historical cost basis.`);
        console.log("No database changes were made. Re-run with --apply after verifying DATABASE_URL and costs.");
        return;
    }
    console.log(`Seeding ${CATALOG.length} PlayStation USA extra denoms...`);
    for (const spec of CATALOG) {
        const { product, cost } = await upsertProduct(spec);
        console.log(
            `✓ ${product.name} (${product.sku}) — cost ${cost} COP`,
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
