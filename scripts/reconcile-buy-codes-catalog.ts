/**
 * Idempotent activation of Buy Codes families (src/lib/catalog/buy-codes.ts):
 * the SAS Product/Denomination/global cost plus Diem StoreProduct fulfillment.
 *
 * Usage:
 *   npm run catalog:reconcile -- --family google-play,nintendo
 *   npm run catalog:reconcile -- --family google-play,nintendo --apply
 *
 * Dry-run is the default. Never deletes or deactivates anything outside the
 * spec. Refuses to apply if a Diem StoreProduct is missing or cannot enable
 * fulfillment (no active inventory source). Loads .env.local if present.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { Prisma, PrismaClient } from "@prisma/client";

import {
    BUY_CODES_FAMILIES,
    catalogDrift,
    type BuyCodesFamily,
    type CatalogProductSpec,
} from "../src/lib/catalog/buy-codes";
import { listOpsStoreProducts, setOpsStoreProductFulfillment, type OpsStoreProductRow } from "../src/lib/devdiem/ops";
import { runSerializableTransaction } from "../src/lib/prisma-transaction";

try {
    for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const idx = trimmed.indexOf("=");
        if (idx === -1) continue;
        let value = trimmed.slice(idx + 1);
        if (/^(".*"|'.*')$/.test(value)) value = value.slice(1, -1);
        process.env[trimmed.slice(0, idx)] ??= value;
    }
} catch {
    // Rely on existing process.env.
}

const prisma = new PrismaClient();

type DiemAction = "enabled" | "enable" | "missing" | "blocked";

type PlanRow = {
    sku: string;
    name: string;
    sas: "create" | "update" | "unchanged";
    drift: string[];
    diem: Array<{ devDiemProductId: string; storeProductId: string | null; action: DiemAction }>;
};

function selectedFamilies(): BuyCodesFamily[] {
    const index = process.argv.indexOf("--family");
    const raw = index === -1 ? Object.keys(BUY_CODES_FAMILIES).join(",") : process.argv[index + 1] ?? "";
    const families = raw.split(",").map((item) => item.trim()).filter(Boolean);
    const unknown = families.filter((item) => !(item in BUY_CODES_FAMILIES));
    if (unknown.length || families.length === 0) {
        throw new Error(`Familia desconocida: ${unknown.join(", ") || raw}. Opciones: ${Object.keys(BUY_CODES_FAMILIES).join(", ")}`);
    }
    return families as BuyCodesFamily[];
}

async function loadDiemRows(specs: readonly CatalogProductSpec[]): Promise<Map<string, OpsStoreProductRow>> {
    const rows = new Map<string, OpsStoreProductRow>();
    for (const brand of new Set(specs.map((spec) => spec.brand))) {
        for (const row of await listOpsStoreProducts({ q: brand })) rows.set(row.product_id, row);
    }
    return rows;
}

async function plan(specs: readonly CatalogProductSpec[]): Promise<PlanRow[]> {
    const [products, diemRows] = await Promise.all([
        prisma.product.findMany({
            where: { sku: { in: specs.map((spec) => spec.sku) } },
            include: { denominations: true, costs: true },
        }),
        loadDiemRows(specs),
    ]);
    const bySku = new Map(products.map((product) => [product.sku, product]));
    return specs.map((spec) => {
        const drift = catalogDrift(spec, bySku.get(spec.sku) ?? null);
        return {
            sku: spec.sku,
            name: spec.name,
            sas: drift[0] === "missing" ? "create" : drift.length ? "update" : "unchanged",
            drift,
            diem: spec.denominations.map((denomination) => {
                const row = diemRows.get(denomination.devDiemProductId);
                const action: DiemAction = !row
                    ? "missing"
                    : row.fulfillment_enabled
                        ? "enabled"
                        : row.can_enable_fulfillment ? "enable" : "blocked";
                return { devDiemProductId: denomination.devDiemProductId, storeProductId: row?.store_product_id ?? null, action };
            }),
        };
    });
}

async function upsertSpec(tx: Prisma.TransactionClient, spec: CatalogProductSpec) {
    const product = await tx.product.upsert({
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
    for (const item of spec.denominations) {
        const byRemote = await tx.productDenomination.findUnique({ where: { devDiemProductId: item.devDiemProductId } });
        if (byRemote && byRemote.productId !== product.id) {
            throw new Error(`${item.devDiemProductId} ya está mapeado a otro producto (${byRemote.productId})`);
        }
        const denomination = byRemote
            ? await tx.productDenomination.update({
                where: { id: byRemote.id },
                data: { amount: item.amount, currency: item.currency },
            })
            : await tx.productDenomination.upsert({
                where: { productId_amount: { productId: product.id, amount: item.amount } },
                update: { currency: item.currency, devDiemProductId: item.devDiemProductId },
                create: {
                    productId: product.id,
                    amount: item.amount,
                    currency: item.currency,
                    devDiemProductId: item.devDiemProductId,
                },
            });
        const cost = await tx.productCost.findFirst({
            where: { companyId: null, productId: product.id, denominationId: denomination.id },
            orderBy: { createdAt: "asc" },
        });
        if (cost) {
            await tx.productCost.update({
                where: { id: cost.id },
                data: { cost: item.cost, currency: "COP", isActive: true },
            });
        } else {
            await tx.productCost.create({
                data: {
                    companyId: null,
                    productId: product.id,
                    denominationId: denomination.id,
                    cost: item.cost,
                    currency: "COP",
                    isActive: true,
                },
            });
        }
    }
}

async function main() {
    const families = selectedFamilies();
    const specs = families.flatMap((family) => BUY_CODES_FAMILIES[family]);
    const before = await plan(specs);
    const apply = process.argv.includes("--apply");
    if (!apply) {
        console.log(JSON.stringify({ apply, families, plan: before }, null, 2));
        console.log("No se hicieron cambios. Revisa el plan y repite con --apply.");
        return;
    }

    const blocked = before.flatMap((row) => row.diem.filter((item) => item.action === "missing" || item.action === "blocked"));
    if (blocked.length) {
        throw new Error(`Diem no puede atender: ${JSON.stringify(blocked)}. No se aplicó nada.`);
    }

    const pending = specs.filter((spec) => before.find((row) => row.sku === spec.sku)?.sas !== "unchanged");
    if (pending.length) {
        await runSerializableTransaction(prisma, async (tx) => {
            for (const spec of pending) await upsertSpec(tx, spec);
        }, { timeoutMs: 30_000 });
    }
    for (const item of before.flatMap((row) => row.diem)) {
        if (item.action === "enable" && item.storeProductId) {
            await setOpsStoreProductFulfillment({ storeProductId: item.storeProductId, enabled: true });
        }
    }

    const after = await plan(specs);
    const unresolved = after.filter((row) => row.sas !== "unchanged" || row.diem.some((item) => item.action !== "enabled"));
    console.log(JSON.stringify({ apply, families, plan: before, verification: after }, null, 2));
    if (unresolved.length) throw new Error(`Quedaron diferencias: ${unresolved.map((row) => row.sku).join(", ")}`);
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
