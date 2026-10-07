/** Normalize only the 12 reconstructed Virtual Zone wallet descriptions. */
import { createHash } from "node:crypto";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { Prisma, PrismaClient } from "@prisma/client";
import { walletPurchaseDescription } from "../src/lib/wallet/presentation";

const prisma = new PrismaClient();
const COMPANY_ID = "cms92txq90000amogy81su0zd";
const WALLET_ID = "cms9j3dlt000411e1hs770uis";
const LOCK_NAME = "virtual-zone-wallet-descriptions-2026-10-v1";
const PURCHASE_IDS = [
    "cmuq2fmgd0002ccz9cjsaj3ll",
    "cmurbhgiq000813sn56tqydkr",
    "cmurbged1000213sn967uhba3",
    "cmurdx70p0002var0t9whphk0",
    "cmurnogn40008nx2efqbdcwrq",
    "cmurnuub20002k9dbq1kqwptk",
    "cmushj9oo000210sd4m6yvh8u",
    "cmusnr5ne0002ucshew356hbi",
    "cmuvry6r30002dmiz0h081wna",
    "cmuvs5i0v0002khf2qw4xs52u",
    "cmuvs62yn0008khf2ch8jlz6x",
    "cmuwznpcp00028ehobr6r8nop",
] as const;

type Db = Prisma.TransactionClient | PrismaClient;
type Receipt = {
    version: 1;
    database: string;
    fingerprint: string;
    invariantFingerprint: string;
    changes: Array<{
        transactionId: string;
        purchaseId: string;
        before: string | null;
        after: string;
    }>;
};

const sha = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");
const canonical = (value: unknown): string => value instanceof Date
    ? JSON.stringify(value.toISOString())
    : Array.isArray(value)
        ? `[${value.map(canonical).join(",")}]`
        : value && typeof value === "object"
            ? `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, nested]) => `${JSON.stringify(key)}:${canonical(nested)}`).join(",")}}`
            : JSON.stringify(value);

function parseArgs() {
    const [mode, ...rest] = process.argv.slice(2);
    if (mode !== "plan" && mode !== "apply") {
        throw new Error("Uso: normalize:virtual-zone-descriptions <plan|apply> ...");
    }
    const values = new Map<string, string>();
    for (let index = 0; index < rest.length; index += 2) {
        values.set(rest[index].replace(/^--/, ""), rest[index + 1]);
    }
    for (const key of ["receipt", "expected-database"]) {
        if (!values.get(key)) throw new Error(`Falta --${key}`);
    }
    if (mode === "apply") {
        for (const key of ["receipt-sha256", "backup", "report"]) {
            if (!values.get(key)) throw new Error(`apply exige --${key}`);
        }
    }
    return { mode, values } as const;
}

function privateJson(path: string, payload: unknown) {
    const target = resolve(path);
    mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
    writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
    chmodSync(target, 0o600);
}

async function databaseName(db: Db = prisma): Promise<string> {
    const rows = await db.$queryRaw<Array<{ current_database: string }>>`SELECT current_database()`;
    return rows[0].current_database;
}

async function snapshot(db: Db = prisma) {
    const [wallet, purchases, transactions, statementCount] = await Promise.all([
        db.wallet.findUnique({
            where: { id: WALLET_ID },
            select: { id: true, companyId: true, currency: true, balance: true },
        }),
        db.codePurchase.findMany({
            where: { id: { in: [...PURCHASE_IDS] }, companyId: COMPANY_ID },
            select: {
                id: true,
                companyId: true,
                productId: true,
                count: true,
                totalAmount: true,
                currency: true,
                status: true,
                occurredAt: true,
                occurredSequence: true,
                storeId: true,
                purchaseOriginPhoneId: true,
                originLabelSnapshot: true,
                deliveredCodes: true,
            },
            orderBy: { id: "asc" },
        }),
        db.walletTransaction.findMany({
            where: {
                walletId: WALLET_ID,
                type: "CONSUMPTION",
                codePurchaseId: { in: [...PURCHASE_IDS] },
            },
            select: {
                id: true,
                walletId: true,
                type: true,
                status: true,
                amount: true,
                balanceAfter: true,
                originalAmount: true,
                originalCurrency: true,
                exchangeRate: true,
                description: true,
                codePurchaseId: true,
                occurredAt: true,
                occurredSequence: true,
            },
            orderBy: { id: "asc" },
        }),
        db.accountStatement.count({ where: { companyId: COMPANY_ID } }),
    ]);
    const productIds = [...new Set(purchases.map((purchase) => purchase.productId))];
    const products = await db.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true },
        orderBy: { id: "asc" },
    });
    const safePurchases = purchases.map(({ deliveredCodes, ...purchase }) => ({
        ...purchase,
        deliveredCodeHashes: Array.isArray(deliveredCodes)
            ? deliveredCodes.map((code) => sha(String(code))).sort()
            : [],
    }));
    const safe = { wallet, statementCount, purchases: safePurchases, transactions, products };
    const invariant = {
        ...safe,
        transactions: transactions.map(({ description, ...transaction }) => {
            void description;
            return transaction;
        }),
    };
    return {
        ...safe,
        fingerprint: sha(canonical(safe)),
        invariantFingerprint: sha(canonical(invariant)),
    };
}

function plannedChanges(snap: Awaited<ReturnType<typeof snapshot>>) {
    if (!snap.wallet || snap.wallet.companyId !== COMPANY_ID) throw new Error("Wallet de Virtual Zone inválida");
    if (snap.statementCount !== 0) throw new Error("Virtual Zone ya tiene estados de cuenta emitidos");
    if (snap.purchases.length !== PURCHASE_IDS.length || snap.transactions.length !== PURCHASE_IDS.length) {
        throw new Error("No se encontraron exactamente las 12 compras y movimientos esperados");
    }
    const productMap = new Map(snap.products.map((product) => [product.id, product.name]));
    const purchaseMap = new Map(snap.purchases.map((purchase) => [purchase.id, purchase]));
    return snap.transactions.map((transaction) => {
        const purchase = transaction.codePurchaseId
            ? purchaseMap.get(transaction.codePurchaseId)
            : undefined;
        if (!purchase || purchase.status !== "COMPLETED") {
            throw new Error(`Compra ausente o no completada para ${transaction.id}`);
        }
        const productName = productMap.get(purchase.productId);
        if (!productName || !productName.endsWith("— USA")) {
            throw new Error(`Nombre canónico de producto inesperado para ${purchase.id}`);
        }
        return {
            transactionId: transaction.id,
            purchaseId: purchase.id,
            before: transaction.description,
            after: walletPurchaseDescription(purchase.count, productName),
        };
    });
}

async function plan(receiptPath: string, expectedDatabase: string) {
    const database = await databaseName();
    if (database !== expectedDatabase) throw new Error(`Base inesperada: ${database}`);
    const snap = await snapshot();
    const receipt: Receipt = {
        version: 1,
        database,
        fingerprint: snap.fingerprint,
        invariantFingerprint: snap.invariantFingerprint,
        changes: plannedChanges(snap),
    };
    privateJson(receiptPath, receipt);
    const receiptHash = sha(readFileSync(resolve(receiptPath)));
    console.log(JSON.stringify({ mode: "plan", database, changes: receipt.changes, receiptSha256: receiptHash }, null, 2));
}

async function apply(values: Map<string, string>) {
    const receiptPath = resolve(values.get("receipt")!);
    const rawReceipt = readFileSync(receiptPath);
    if (sha(rawReceipt) !== values.get("receipt-sha256")!.toLowerCase()) {
        throw new Error("El hash del recibo no coincide");
    }
    const receipt = JSON.parse(rawReceipt.toString("utf8")) as Receipt;
    const database = await databaseName();
    if (receipt.version !== 1 || database !== values.get("expected-database") || receipt.database !== database) {
        throw new Error(`Base o versión inesperada: ${database}`);
    }
    const before = await snapshot();
    const beforeChanges = plannedChanges(before);
    const alreadyApplied = beforeChanges.every((change) => change.before === change.after);
    if (
        before.invariantFingerprint !== receipt.invariantFingerprint
        || (before.fingerprint !== receipt.fingerprint && !alreadyApplied)
    ) throw new Error("La base cambió después del plan");
    privateJson(values.get("backup")!, before);

    const result = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${LOCK_NAME}))`;
        await tx.$queryRaw`SELECT "id" FROM "Wallet" WHERE "id" = ${WALLET_ID} FOR UPDATE`;
        const locked = await snapshot(tx);
        const changes = plannedChanges(locked);
        const noOp = changes.every((change) => change.before === change.after);
        if (
            locked.invariantFingerprint !== receipt.invariantFingerprint
            || (locked.fingerprint !== receipt.fingerprint && !noOp)
        ) throw new Error("La base cambió al obtener el bloqueo");
        if (!noOp) {
            for (const change of changes) {
                const updated = await tx.walletTransaction.updateMany({
                    where: {
                        id: change.transactionId,
                        walletId: WALLET_ID,
                        type: "CONSUMPTION",
                        codePurchaseId: change.purchaseId,
                    },
                    data: { description: change.after },
                });
                if (updated.count !== 1) throw new Error(`No se actualizó ${change.transactionId}`);
            }
        }
        const after = await snapshot(tx);
        if (after.invariantFingerprint !== receipt.invariantFingerprint) {
            throw new Error("Cambió información distinta de las descripciones");
        }
        const afterChanges = plannedChanges(after);
        if (afterChanges.some((change) => change.before !== change.after)) {
            throw new Error("Quedaron descripciones sin normalizar");
        }
        return { applied: !noOp, changed: noOp ? 0 : changes.length, after };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 30_000 });

    privateJson(values.get("report")!, {
        mode: "apply",
        database,
        applied: result.applied,
        changed: result.changed,
        invariantFingerprint: result.after.invariantFingerprint,
        walletBalance: result.after.wallet?.balance,
    });
    console.log(JSON.stringify({ mode: "apply", database, applied: result.applied, changed: result.changed }, null, 2));
}

async function main() {
    const { mode, values } = parseArgs();
    if (mode === "plan") await plan(values.get("receipt")!, values.get("expected-database")!);
    else await apply(values);
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
