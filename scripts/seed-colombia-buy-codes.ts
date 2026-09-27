/**
 * Idempotent seed for Colombia Buy Codes catalog:
 * Xbox Game Pass + Xbox Gift Cards, Free Fire, Netflix COP.
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/seed-colombia-buy-codes.ts
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/seed-colombia-buy-codes.ts --apply
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

type DenomSpec = {
    amount: number;
    currency: string;
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
    // Xbox Game Pass — one product per tier/duration (UI needs name, not just amount)
    {
        name: "Xbox Game Pass Essential 1 Mes",
        sku: "799366084340",
        brand: "Xbox",
        category: "Game Pass",
        denominations: [{
            amount: 29900,
            currency: "COP",
            devDiemProductId: "ae4b2de9-05b9-41ec-9573-1b9216097e86",
            cost: 29900,
        }],
    },
    {
        name: "Xbox Game Pass Essential 6 Meses",
        sku: "196742159868",
        brand: "Xbox",
        category: "Game Pass",
        denominations: [{
            amount: 129900,
            currency: "COP",
            devDiemProductId: "dc10d09f-b78b-40ef-a406-65449a7921dd",
            cost: 129900,
        }],
    },
    {
        name: "Xbox Game Pass Premium 1 Mes",
        sku: "42425232423",
        brand: "Xbox",
        category: "Game Pass",
        denominations: [{
            amount: 39900,
            currency: "COP",
            devDiemProductId: "9e6262df-db45-42a0-a24c-fecf9be7056c",
            cost: 39900,
        }],
    },
    {
        name: "Xbox Game Pass Premium 3 Meses",
        sku: "196742160659",
        brand: "Xbox",
        category: "Game Pass",
        denominations: [{
            amount: 119900,
            currency: "COP",
            devDiemProductId: "751e9091-c3d8-4f67-af64-2de5ec9d9564",
            cost: 119900,
        }],
    },
    {
        name: "Xbox Game Pass Ultimate 1 Mes",
        sku: "799366942962",
        brand: "Xbox",
        category: "Game Pass",
        denominations: [{
            amount: 49900,
            currency: "COP",
            devDiemProductId: "24b01b6e-ccc2-49e5-829a-af1f317a0529",
            cost: 49900,
        }],
    },
    {
        name: "Xbox Game Pass Ultimate 3 Meses",
        sku: "799366942979",
        brand: "Xbox",
        category: "Game Pass",
        denominations: [{
            amount: 149900,
            currency: "COP",
            devDiemProductId: "8bdd8755-b721-4458-a66a-ff3982fd0338",
            cost: 149900,
        }],
    },
    {
        name: "Xbox Game Pass Core 3 Meses",
        sku: "799366498759",
        brand: "Xbox",
        category: "Game Pass",
        denominations: [{
            amount: 87900,
            currency: "COP",
            devDiemProductId: "1b07aff9-b38c-4a3e-95b2-cf4efc56d89e",
            cost: 87900,
        }],
    },
    {
        name: "Xbox Game Pass Core 12 Meses",
        sku: "799366498759-1",
        brand: "Xbox",
        category: "Game Pass",
        denominations: [{
            amount: 201900,
            currency: "COP",
            devDiemProductId: "c3985246-0e80-40eb-8dd3-408ef051f5f8",
            cost: 201900,
        }],
    },
    // Xbox Gift Cards — one product, four denoms
    {
        name: "Xbox Gift Card Colombia",
        sku: "XBOX-GC-CO",
        brand: "Xbox",
        category: "Gift Card",
        denominations: [
            {
                amount: 30000,
                currency: "COP",
                devDiemProductId: "f4328e0f-7a57-413b-bb4e-96ffa7d1cbb6",
                cost: 30000,
            },
            {
                amount: 55000,
                currency: "COP",
                devDiemProductId: "686d18c8-0c71-4ac2-994e-f6fe832879b5",
                cost: 55000,
            },
            {
                amount: 100000,
                currency: "COP",
                devDiemProductId: "a50735d0-b6b2-469e-a3b3-249dfed3c8ae",
                cost: 100000,
            },
            {
                amount: 150000,
                currency: "COP",
                devDiemProductId: "98ef59af-4e1e-497c-8e78-285a348526a1",
                cost: 150000,
            },
        ],
    },
    // Free Fire — one product per diamond pack (name shows diamonds)
    {
        name: "Free Fire 100 diamantes",
        sku: "799366881445",
        brand: "Free Fire",
        category: "Diamonds",
        denominations: [{
            amount: 4200,
            currency: "COP",
            devDiemProductId: "ca27b242-0f3c-4420-b7ee-c7ca0401b7e0",
            cost: 4200,
        }],
    },
    {
        name: "Free Fire 310 diamantes",
        sku: "799366881452",
        brand: "Free Fire",
        category: "Diamonds",
        denominations: [{
            amount: 12000,
            currency: "COP",
            devDiemProductId: "19ae3887-28db-4fe4-960c-59b50c516628",
            cost: 12000,
        }],
    },
    {
        name: "Free Fire 520 diamantes",
        sku: "799366881469",
        brand: "Free Fire",
        category: "Diamonds",
        denominations: [{
            amount: 19600,
            currency: "COP",
            devDiemProductId: "ecd4534d-15ef-45de-a76f-bc3b72441816",
            cost: 19600,
        }],
    },
    {
        name: "Free Fire 1060 diamantes",
        sku: "799366881476",
        brand: "Free Fire",
        category: "Diamonds",
        denominations: [{
            amount: 38600,
            currency: "COP",
            devDiemProductId: "d46848cd-23b1-424f-a5d5-31c71007e2aa",
            cost: 38600,
        }],
    },
    {
        name: "Free Fire 2180 diamantes",
        sku: "799366881483",
        brand: "Free Fire",
        category: "Diamonds",
        denominations: [{
            amount: 76800,
            currency: "COP",
            devDiemProductId: "2c4b1f51-24c2-478b-b469-7692ddd65575",
            cost: 76800,
        }],
    },
    {
        name: "Free Fire 5600 diamantes",
        sku: "799366881490",
        brand: "Free Fire",
        category: "Diamonds",
        denominations: [{
            amount: 182400,
            currency: "COP",
            devDiemProductId: "f83bba7d-99fe-4351-bb71-99bed77dd9ab",
            cost: 182400,
        }],
    },
    // Netflix Colombia — one product, five denoms
    {
        name: "Netflix Colombia",
        sku: "NETFLIX-CO",
        brand: "Netflix",
        category: "Entertainment",
        denominations: [
            {
                amount: 20000,
                currency: "COP",
                devDiemProductId: "13f3168d-111d-447d-9025-0b0e3cf09aa9",
                cost: 20000,
            },
            {
                amount: 30000,
                currency: "COP",
                devDiemProductId: "ad7005a8-78bd-46b3-88e9-ce7de54ec10f",
                cost: 30000,
            },
            {
                amount: 35000,
                currency: "COP",
                devDiemProductId: "0813e515-a679-454a-8c19-618f5d5560b4",
                cost: 35000,
            },
            {
                amount: 40000,
                currency: "COP",
                devDiemProductId: "8aa3925f-c3ad-49c6-b755-f50cde0a961d",
                cost: 40000,
            },
            {
                amount: 50000,
                currency: "COP",
                devDiemProductId: "ebcedcc9-a658-4742-8cf3-b79e29104cbc",
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
            // Mapping lives on denominations for multi-SKU families
            devDiemProductId: null,
        },
        create: {
            name: spec.name,
            sku: spec.sku,
            brand: spec.brand,
            category: spec.category,
            isActive: true,
        },
    });

    for (const denom of spec.denominations) {
        // Prefer match by remote UUID so amount changes stay idempotent
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

async function deactivateNetflixUsdSeed() {
    const updated = await prisma.product.updateMany({
        where: { sku: "NFLX-USD" },
        data: { isActive: false, devDiemProductId: null },
    });
    if (updated.count) {
        console.log(`Deactivated NFLX-USD seed (${updated.count} product)`);
    }
}

async function main() {
    if (!process.argv.includes("--apply")) {
        console.log(`PLAN: ${CATALOG.length} Colombia products would be upserted and the legacy NFLX-USD seed would be deactivated.`);
        console.log("No database changes were made. Re-run with --apply after verifying DATABASE_URL.");
        return;
    }
    console.log(`Seeding ${CATALOG.length} Colombia Buy Codes products...`);
    for (const spec of CATALOG) {
        const product = await upsertProduct(spec);
        console.log(
            `✓ ${product.name} (${product.sku}) — ${spec.denominations.length} denom(s)`,
        );
    }
    await deactivateNetflixUsdSeed();
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
