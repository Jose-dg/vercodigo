/**
 * Preflight mappings + smoke purchase for Colombia catalog.
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/preflight-colombia-buy-codes.ts
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/preflight-colombia-buy-codes.ts --smoke --confirm-smoke
 *
 * Loads .env.local and fails closed when its configured Diem API is unreachable.
 *
 * After provisioning Steam COP / Mercado Libre / IMVU / Google Play / Uber:
 *   python manage.py provision_colombia_gift_cards --apply
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/seed-steam-buy-codes.ts --apply
 *   npx tsx scripts/seed-meli-buy-codes.ts --apply
 *   npx tsx scripts/seed-colombia-pins-buy-codes.ts --apply
 *   GET {DIEM_API}/api/v1/catalog/products/?store_id={DIEM_STORE_ID}&fulfillment_enabled=true
 *   GET /api/products?purchasable=true  → listed under región CO
 * This script does not load PINs; without stock purchases stay AWAITING_STOCK.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";

import {
    RETIRED_STEAM_SKUS,
    STEAM_COP_CATALOG,
} from "../src/lib/catalog/steam";

const envPath = resolve(process.cwd(), ".env.local");
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

const doSmoke = process.argv.includes("--smoke");
const confirmedSmoke = process.argv.includes("--confirm-smoke");

async function ensureDiemReachable() {
    const configured = process.env.DIEM_API_URL?.replace(/\/+$/, "") || "";
    if (!configured) throw new Error("DIEM_API_URL is required");
    try {
        const response = await fetch(`${configured}/api/v1/catalog/products/?store_id=${process.env.DIEM_STORE_ID}&fulfillment_enabled=true&page_size=1`, {
            headers: {
                Authorization: `Bearer ${process.env.DIEM_SERVICE_API_KEY}`,
                Accept: "application/json",
            },
        });
        if (!response.ok) {
            throw new Error(`Diem catalog returned HTTP ${response.status}`);
        }
        process.env.DIEM_API_URL = configured;
        console.log(`Using configured DIEM_API_URL=${configured} (HTTP ${response.status})`);
    } catch (error) {
        throw new Error(
            `Configured Diem API is unreachable: ${error instanceof Error ? error.message : error}`,
        );
    }
}

async function main() {
    if (doSmoke && !confirmedSmoke) {
        throw new Error("--smoke creates a real one-unit purchase; repeat with --confirm-smoke to continue.");
    }
    await ensureDiemReachable();

    const { checkDiemConnection } = await import("../src/lib/devdiem/fulfillment");
    const prisma = (await import("../src/lib/prisma")).default;

    const remote = await checkDiemConnection();
    const remoteIds = new Set(remote.catalogProductIds);
    console.log(`Catalog remote products: ${remote.catalogProducts}`);

    const products = await prisma.product.findMany({
        where: { isActive: true },
        select: {
            id: true,
            name: true,
            sku: true,
            brand: true,
            isActive: true,
            devDiemProductId: true,
            denominations: {
                select: {
                    id: true,
                    amount: true,
                    currency: true,
                    devDiemProductId: true,
                },
            },
        },
        orderBy: { name: "asc" },
    });

    const unmapped: string[] = [];
    const unknown: string[] = [];
    const missingExpected: string[] = [];
    const mismatchedExpected: string[] = [];
    const colombia = products.filter((p) =>
        ["Xbox", "Free Fire", "Netflix", "Steam", "Mercado Libre", "IMVU", "Google Play", "Uber"].includes(p.brand)
        && p.sku !== "NFLX-USD",
    );

    for (const product of products) {
        if (!product.denominations.length) {
            if (!product.devDiemProductId) {
                unmapped.push(`${product.sku} (product)`);
            } else if (!remoteIds.has(product.devDiemProductId)) {
                unknown.push(`${product.sku} → ${product.devDiemProductId}`);
            }
            continue;
        }
        for (const denom of product.denominations) {
            const mapping = denom.devDiemProductId ?? product.devDiemProductId;
            if (!mapping) {
                unmapped.push(`${product.sku} @ ${denom.amount}`);
                continue;
            }
            if (!remoteIds.has(mapping)) {
                unknown.push(`${product.sku} @ ${denom.amount} → ${mapping}`);
            }
        }
    }

    const productsBySku = new Map(products.map((product) => [product.sku, product]));
    for (const expected of STEAM_COP_CATALOG) {
        const product = productsBySku.get(expected.sku);
        if (!product) {
            missingExpected.push(expected.sku);
            continue;
        }
        const denomination = product.denominations.find((row) => (
            row.devDiemProductId === expected.devDiemProductId
        ));
        if (
            !denomination
            || denomination.amount !== expected.amount
            || denomination.currency !== expected.currency
        ) {
            mismatchedExpected.push(
                `${expected.sku} expected ${expected.amount} ${expected.currency} → ${expected.devDiemProductId}`,
            );
        }
    }

    const retiredStillActive = await prisma.product.findMany({
        where: { sku: { in: [...RETIRED_STEAM_SKUS] }, isActive: true },
        select: { sku: true },
    });

    console.log(`Colombia brand products: ${colombia.length}`);
    for (const p of colombia) {
        console.log(
            `  - ${p.name} (${p.sku}) denoms=${p.denominations.length} mapped=${
                p.denominations.filter((d) => d.devDiemProductId && remoteIds.has(d.devDiemProductId)).length
            }`,
        );
    }

    const nflx = await prisma.product.findUnique({ where: { sku: "NFLX-USD" } });
    console.log(`NFLX-USD isActive=${nflx?.isActive ?? "missing"}`);

    const ok = unmapped.length === 0
        && unknown.length === 0
        && missingExpected.length === 0
        && mismatchedExpected.length === 0
        && retiredStillActive.length === 0
        && remote.catalogProducts > 0;
    console.log(JSON.stringify({
        ok,
        unmapped,
        unknownMappings: unknown,
        missingExpected,
        mismatchedExpected,
        retiredStillActive: retiredStillActive.map((product) => product.sku),
    }, null, 2));
    if (!ok) {
        process.exitCode = 1;
        return;
    }

    if (!doSmoke) {
        console.log("Preflight OK. Re-run with --smoke --confirm-smoke to create the one-unit smoke purchase.");
        return;
    }

    const { purchaseCodes, processCodePurchase } = await import(
        "../src/services/self-service/purchase-codes.service"
    );

    // Smoke: use a mapped automatic product with inventory in the restored DB.
    const smoke = await prisma.product.findUnique({
        where: { sku: "799366881483" },
        include: { denominations: true },
    });
    if (!smoke?.denominations[0]) throw new Error("Smoke product missing");

    let user = await prisma.user.findUnique({
        where: { email: "lorena@laboratorioclinicadelplay.com" },
        select: {
            id: true,
            email: true,
            role: true,
            companyId: true,
            storeId: true,
        },
    });
    if (!user) {
        user = await prisma.user.findFirst({
            where: { role: "SUPER_ADMIN" },
            select: {
                id: true,
                email: true,
                role: true,
                companyId: true,
                storeId: true,
            },
        });
    }
    if (!user?.email) throw new Error("No user for smoke purchase");
    console.log(`Smoke buyer role: ${user.role}`);

    const targetCompanyId = user.companyId
        ?? (await prisma.company.findFirst({ select: { id: true } }))?.id;
    if (!targetCompanyId && (user.role === "SUPER_ADMIN" || user.role === "SYSTEM_ADMIN")) {
        throw new Error("No company for platform smoke purchase");
    }

    const result = await purchaseCodes({
        userId: user.id,
        actorRole: user.role,
        targetCompanyId:
            user.role === "SUPER_ADMIN" || user.role === "SYSTEM_ADMIN"
                ? targetCompanyId!
                : undefined,
        productId: smoke.id,
        denominationId: smoke.denominations[0].id,
        count: 1,
        idempotencyKey: `smoke-colombia-free-fire-${randomUUID()}`,
    });
    console.log("Initial purchase:", {
        id: result.id,
        status: result.status,
        fulfillmentStatus: result.fulfillmentStatus,
        keys: result.keys?.length ?? 0,
        lastError: result.lastError,
    });

    let current = result;
    for (let i = 0; i < 20; i++) {
        if (["COMPLETED", "FAILED", "ACTION_REQUIRED"].includes(current.status)) break;
        await new Promise((r) => setTimeout(r, 2000));
        current = await processCodePurchase(current.id);
        console.log(`Poll ${i + 1}:`, {
            status: current.status,
            fulfillmentStatus: current.fulfillmentStatus,
            keys: current.keys?.length ?? 0,
            lastError: current.lastError,
        });
    }

    if (current.status !== "COMPLETED" || !(current.keys?.length)) {
        throw new Error(`Smoke failed: status=${current.status} error=${current.lastError}`);
    }
    console.log(`SMOKE OK — delivered codes=${current.keys.length}`);
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        const prisma = (await import("../src/lib/prisma")).default;
        await prisma.$disconnect();
    });
