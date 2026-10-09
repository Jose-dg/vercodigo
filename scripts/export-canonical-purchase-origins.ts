/**
 * Read-only export of the canonical purchase origin of every code purchase
 * linked to Diem. Diem's `normalize_purchase_origins` command uses it as the
 * source of truth to replace non-canonical historical origin snapshots.
 *
 *   npm run origins:export -- --output .secure/canonical-purchase-origins.json
 */
import { createHash } from "node:crypto";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { PrismaClient } from "@prisma/client";
import { purchaseOriginSnapshot } from "../src/lib/purchases/origin-snapshot";

const prisma = new PrismaClient();

async function main() {
    const outputIndex = process.argv.indexOf("--output");
    const output = outputIndex >= 0 ? process.argv[outputIndex + 1] : undefined;
    if (!output) throw new Error("Uso: npm run origins:export -- --output <ruta>");

    const purchases = await prisma.codePurchase.findMany({
        where: { diemRequestId: { not: null } },
        select: {
            id: true,
            diemRequestId: true,
            storeId: true,
            purchaseOriginPhoneId: true,
            originLabelSnapshot: true,
            purchaseOriginPhone: { select: { phone: true } },
        },
        orderBy: { id: "asc" },
    });
    const origins = purchases.map((purchase) => ({
        purchaseId: purchase.id,
        externalReference: `DIEM-SAS-PURCHASE-${purchase.id}`,
        diemRequestId: purchase.diemRequestId!,
        origin: purchaseOriginSnapshot(purchase),
    }));
    const body = `${JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), origins }, null, 2)}\n`;

    const target = resolve(output);
    mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
    writeFileSync(target, body, { mode: 0o600 });
    chmodSync(target, 0o600);
    console.log(JSON.stringify({
        output: target,
        purchases: origins.length,
        sha256: createHash("sha256").update(body).digest("hex"),
    }, null, 2));
}

main()
    .catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
