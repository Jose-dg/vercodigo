/**
 * Idempotent seed for Steam wallet SKUs in Buy Codes (diem-sas).
 * Maps each Diem Product UUID via denomination.devDiemProductId.
 *
 * Usage:
 *   npx tsx scripts/seed-steam-buy-codes.ts
 *
 * Requires DATABASE_URL (loads .env.local if present).
 * Prerequisite: Diem StoreProduct.fulfillment_enabled=True for these UUIDs.
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
    currency: "USD" | "COP";
    devDiemProductId: string;
    /** Wallet debit cost in the denomination currency (COP for COP SKUs). */
    cost?: number;
};

const CATALOG: ProductSpec[] = [
    {
        name: "Steam Wallet US$5",
        sku: "79936608432A",
        amount: 5,
        currency: "USD",
        devDiemProductId: "0953a6e5-a4dd-414a-b4b1-75621ee5e074",
    },
    {
        name: "Steam Wallet US$10",
        sku: "93839483",
        amount: 10,
        currency: "USD",
        devDiemProductId: "5d6750dc-d1eb-4105-98c9-45b20ff410c4",
    },
    {
        name: "Steam Wallet US$20",
        sku: "3423242342-25",
        amount: 20,
        currency: "USD",
        devDiemProductId: "f1943029-d4df-4afa-9f83-9f75878bdc33",
    },
    {
        name: "Steam Wallet US$20 (alt)",
        sku: "7993660843273",
        amount: 20,
        currency: "USD",
        devDiemProductId: "0405e46c-6e43-4dea-ae99-7c4615458c3f",
    },
    {
        name: "Steam Wallet US$25",
        sku: "7993660843223",
        amount: 25,
        currency: "USD",
        devDiemProductId: "77727452-c107-4d7d-9754-d49ef9fb499a",
    },
    {
        name: "Steam Wallet US$50",
        sku: "799366010272",
        amount: 50,
        currency: "USD",
        devDiemProductId: "3b4ff719-3401-4953-acc7-998b2e422560",
    },
    {
        name: "Steam Wallet US$100",
        sku: "3423242342-25-D100-88E399A1",
        amount: 100,
        currency: "USD",
        devDiemProductId: "88e399a1-5aa1-4b2b-9b4f-941b829a46ef",
    },
    {
        name: "Steam Wallet COP $41.000",
        sku: "26030541000",
        amount: 41000,
        currency: "COP",
        cost: 41000,
        devDiemProductId: "978a9348-a74d-4b19-9774-114925a0c7f9",
    },
    {
        name: "Steam Wallet COP $205.000",
        sku: "260305205000",
        amount: 205000,
        currency: "COP",
        cost: 205000,
        devDiemProductId: "103f178e-0730-4b15-acae-c976b0d0b8e2",
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
            brand: "Steam",
            category: "Gift Card Digital",
            isActive: true,
            isGiftCard: true,
            // Mapping lives on denomination (1 Diem SKU = 1 denom).
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
                currency: spec.currency,
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
                currency: spec.currency,
                devDiemProductId: spec.devDiemProductId,
            },
            create: {
                productId: product.id,
                amount: spec.amount,
                currency: spec.currency,
                devDiemProductId: spec.devDiemProductId,
            },
        });
    }

    const cost =
        spec.cost
        ?? (spec.currency === "USD" ? spec.amount * COP_PER_USD : spec.amount);
    const costCurrency = "COP";
    await upsertGlobalCost({
        productId: product.id,
        denominationId: denomination.id,
        cost,
        currency: costCurrency,
    });

    return { product, cost };
}

async function main() {
    console.log(`Seeding ${CATALOG.length} Steam Buy Codes products...`);
    for (const spec of CATALOG) {
        const { product, cost } = await upsertProduct(spec);
        console.log(
            `✓ ${product.name} (${product.sku}) — cost ${cost} COP → ${spec.devDiemProductId}`,
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
