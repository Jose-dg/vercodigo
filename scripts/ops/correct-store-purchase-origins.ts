/**
 * Audits and corrects purchases attributed to the wrong store inside the same
 * company. It never changes the company, wallet, amounts or ledger rows.
 *
 * Plan (read-only):
 *   TS_NODE_BASEURL=. TS_NODE_TRANSPILE_ONLY=1 \
 *     TS_NODE_COMPILER_OPTIONS='{"module":"CommonJS","moduleResolution":"node"}' \
 *     node --conditions=react-server -r ts-node/register -r tsconfig-paths/register \
 *     scripts/ops/correct-store-purchase-origins.ts plan \
 *     --company <company-id> --source-store <wrong-store-id> \
 *     --target-store <correct-store-id> --actor-user <platform-user-id> \
 *     --out .secure/origin-repair-193/receipt.json
 *
 * Apply (writes only through applyPurchaseOriginCorrection):
 *   TS_NODE_BASEURL=. TS_NODE_TRANSPILE_ONLY=1 \
 *     TS_NODE_COMPILER_OPTIONS='{"module":"CommonJS","moduleResolution":"node"}' \
 *     node --conditions=react-server -r ts-node/register -r tsconfig-paths/register \
 *     scripts/ops/correct-store-purchase-origins.ts apply \
 *     --receipt .secure/origin-repair-193/receipt.json \
 *     --expected-database <database-name> \
 *     --report .secure/origin-repair-193/report.json
 */
import { createHash } from "node:crypto";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { Prisma, UserRole } from "@prisma/client";
import prisma from "@/lib/prisma";
import { purchaseOriginSnapshot } from "@/lib/purchases/origin-snapshot";
import { applyPurchaseOriginCorrection } from "@/services/purchases/purchase-origin-correction.service";

const VERSION = 1;
const DEFAULT_REASON = "Compra administrativa atribuida por error a la sede principal; corresponde a la sede 193";
const PLATFORM_ROLES = new Set<UserRole>([UserRole.SUPER_ADMIN, UserRole.SYSTEM_ADMIN]);

type OriginSnapshot = ReturnType<typeof purchaseOriginSnapshot>;

type TransactionSnapshot = {
    id: string;
    walletId: string;
    type: string;
    status: string;
    amount: number;
    balanceAfter: number | null;
    reversalOfId: string | null;
};

type EligiblePurchase = {
    id: string;
    userId: string;
    status: string;
    diemRequestId: string;
    totalAmount: number;
    currency: string;
    occurredAt: string;
    product: string;
    currentOrigin: OriginSnapshot;
    transactions: TransactionSnapshot[];
};

type RepairReceiptBody = {
    version: number;
    database: string;
    createdAt: string;
    company: { id: string; name: string };
    sourceStore: { id: string; name: string; code: string; address: string };
    targetStore: { id: string; name: string; code: string; address: string };
    actor: { id: string; email: string; role: UserRole };
    walletControl: { id: string; currency: string; balance: number };
    eligible: EligiblePurchase[];
    excluded: Array<{
        id: string;
        userId: string;
        status: string;
        diemRequestId: string | null;
        reason: "not_platform_purchase" | "not_completed" | "missing_diem_request";
    }>;
};

type RepairReceipt = RepairReceiptBody & { fingerprint: string };

function arg(name: string): string {
    const index = process.argv.indexOf(`--${name}`);
    const value = index >= 0 ? process.argv[index + 1] : undefined;
    if (!value?.trim()) throw new Error(`Falta --${name}`);
    return value.trim();
}

function optionalArg(name: string): string | undefined {
    const index = process.argv.indexOf(`--${name}`);
    return index >= 0 ? process.argv[index + 1]?.trim() || undefined : undefined;
}

const canonical = (input: unknown): string => input instanceof Date
    ? JSON.stringify(input.toISOString())
    : Array.isArray(input)
        ? `[${input.map(canonical).join(",")}]`
        : input && typeof input === "object"
            ? `{${Object.entries(input as Record<string, unknown>)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, value]) => `${JSON.stringify(key)}:${canonical(value)}`)
                .join(",")}}`
            : JSON.stringify(input);

const fingerprint = (input: unknown) => createHash("sha256").update(canonical(input)).digest("hex");

function writePrivate(path: string, payload: unknown) {
    const target = resolve(path);
    mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
    writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
    chmodSync(target, 0o600);
}

async function databaseIdentity() {
    const rows = await prisma.$queryRaw<Array<{
        database: string;
        read_replica: boolean;
        read_only: boolean;
    }>>(Prisma.sql`
        SELECT
            current_database() AS database,
            pg_is_in_recovery() AS read_replica,
            current_setting('transaction_read_only') = 'on' AS read_only
    `);
    if (!rows[0]) throw new Error("No se pudo identificar la base activa");
    return rows[0];
}

async function transactionSnapshots(purchaseIds: string[]): Promise<Map<string, TransactionSnapshot[]>> {
    const rows = purchaseIds.length === 0 ? [] : await prisma.walletTransaction.findMany({
        where: {
            OR: [
                { codePurchaseId: { in: purchaseIds } },
                { reversalOf: { is: { codePurchaseId: { in: purchaseIds } } } },
            ],
        },
        select: {
            codePurchaseId: true,
            reversalOf: { select: { codePurchaseId: true } },
            id: true,
            walletId: true,
            type: true,
            status: true,
            amount: true,
            balanceAfter: true,
            reversalOfId: true,
        },
        orderBy: { id: "asc" },
    });
    const byPurchase = new Map<string, TransactionSnapshot[]>();
    for (const id of purchaseIds) byPurchase.set(id, []);
    for (const { codePurchaseId, reversalOf, ...row } of rows) {
        const purchaseId = codePurchaseId ?? reversalOf?.codePurchaseId;
        if (purchaseId) byPurchase.get(purchaseId)?.push(row);
    }
    return byPurchase;
}

async function plan() {
    const identity = await databaseIdentity();
    const companyId = arg("company");
    const sourceStoreId = arg("source-store");
    const targetStoreId = arg("target-store");
    if (sourceStoreId === targetStoreId) throw new Error("La sede origen y la sede destino deben ser diferentes");

    const [company, sourceStore, targetStore, actor, wallet] = await Promise.all([
        prisma.company.findUnique({ where: { id: companyId }, select: { id: true, name: true, isActive: true } }),
        prisma.store.findUnique({
            where: { id: sourceStoreId },
            select: { id: true, name: true, code: true, address: true, companyId: true, isActive: true },
        }),
        prisma.store.findUnique({
            where: { id: targetStoreId },
            select: { id: true, name: true, code: true, address: true, companyId: true, isActive: true },
        }),
        prisma.user.findUnique({
            where: { id: arg("actor-user") },
            select: { id: true, email: true, role: true, isActive: true },
        }),
        prisma.wallet.findUnique({
            where: { companyId },
            select: { id: true, currency: true, balance: true },
        }),
    ]);
    if (!company?.isActive) throw new Error("La compañía no existe o está inactiva");
    if (!sourceStore?.isActive || sourceStore.companyId !== company.id) {
        throw new Error("La sede de origen no está activa o no pertenece a la compañía");
    }
    if (!targetStore?.isActive || targetStore.companyId !== company.id) {
        throw new Error("La sede destino no está activa o no pertenece a la compañía");
    }
    if (!actor?.isActive || !PLATFORM_ROLES.has(actor.role)) {
        throw new Error("--actor-user debe ser un administrador de plataforma activo");
    }
    if (!wallet) throw new Error("La compañía no tiene wallet");

    const purchases = await prisma.codePurchase.findMany({
        where: { companyId: company.id, storeId: sourceStore.id },
        select: {
            id: true,
            userId: true,
            status: true,
            diemRequestId: true,
            totalAmount: true,
            currency: true,
            occurredAt: true,
            storeId: true,
            purchaseOriginPhoneId: true,
            originLabelSnapshot: true,
            purchaseOriginPhone: { select: { phone: true } },
            productId: true,
        },
        orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
    });
    const platformUsers = new Set((await prisma.user.findMany({
        where: {
            id: { in: [...new Set(purchases.map((purchase) => purchase.userId))] },
            role: { in: [...PLATFORM_ROLES] },
        },
        select: { id: true },
    })).map((user) => user.id));
    const productNames = new Map((await prisma.product.findMany({
        where: { id: { in: [...new Set(purchases.map((purchase) => purchase.productId))] } },
        select: { id: true, name: true },
    })).map((product) => [product.id, product.name]));
    const eligibleRows = purchases.filter((purchase) => (
        platformUsers.has(purchase.userId)
        && purchase.status === "COMPLETED"
        && purchase.diemRequestId !== null
    ));
    const transactions = await transactionSnapshots(eligibleRows.map((purchase) => purchase.id));

    const eligible: EligiblePurchase[] = eligibleRows.map((purchase) => ({
        id: purchase.id,
        userId: purchase.userId,
        status: purchase.status,
        diemRequestId: purchase.diemRequestId!,
        totalAmount: purchase.totalAmount,
        currency: purchase.currency,
        occurredAt: purchase.occurredAt.toISOString(),
        product: productNames.get(purchase.productId) ?? "Producto",
        currentOrigin: purchaseOriginSnapshot(purchase),
        transactions: transactions.get(purchase.id) ?? [],
    }));
    const excluded: RepairReceiptBody["excluded"] = purchases
        .filter((purchase) => !eligibleRows.some((eligiblePurchase) => eligiblePurchase.id === purchase.id))
        .map((purchase) => ({
            id: purchase.id,
            userId: purchase.userId,
            status: purchase.status,
            diemRequestId: purchase.diemRequestId,
            reason: !platformUsers.has(purchase.userId)
                ? "not_platform_purchase"
                : purchase.status !== "COMPLETED"
                    ? "not_completed"
                    : "missing_diem_request",
        }));

    const body: RepairReceiptBody = {
        version: VERSION,
        database: identity.database,
        createdAt: new Date().toISOString(),
        company: { id: company.id, name: company.name },
        sourceStore: {
            id: sourceStore.id,
            name: sourceStore.name,
            code: sourceStore.code,
            address: sourceStore.address,
        },
        targetStore: {
            id: targetStore.id,
            name: targetStore.name,
            code: targetStore.code,
            address: targetStore.address,
        },
        actor: { id: actor.id, email: actor.email, role: actor.role },
        walletControl: wallet,
        eligible,
        excluded,
    };
    const receipt: RepairReceipt = { ...body, fingerprint: fingerprint(body) };
    writePrivate(arg("out"), receipt);
    console.log(JSON.stringify({
        database: identity,
        company: receipt.company,
        from: receipt.sourceStore,
        to: receipt.targetStore,
        walletControl: receipt.walletControl,
        eligible: eligible.map(({ transactions: rows, ...purchase }) => ({ ...purchase, transactionCount: rows.length })),
        excluded,
        fingerprint: receipt.fingerprint,
    }, null, 2));
    console.log("PLAN OK: solo lectura; no se modificó la base de datos.");
}

function readReceipt(path: string): RepairReceipt {
    const receipt = JSON.parse(readFileSync(resolve(path), "utf8")) as RepairReceipt;
    const { fingerprint: stored, ...body } = receipt;
    if (receipt.version !== VERSION || stored !== fingerprint(body)) {
        throw new Error("El recibo es inválido o fue modificado después del plan");
    }
    return receipt;
}

async function apply() {
    const receipt = readReceipt(arg("receipt"));
    const reportPath = arg("report");
    const expectedDatabase = arg("expected-database");
    const reason = optionalArg("reason") ?? DEFAULT_REASON;
    if (reason.length < 3 || reason.length > 500) throw new Error("El motivo debe tener entre 3 y 500 caracteres");

    const identity = await databaseIdentity();
    if (identity.database !== expectedDatabase || receipt.database !== expectedDatabase) {
        throw new Error("--expected-database no coincide con la base activa y el recibo");
    }
    if (identity.read_only || identity.read_replica) {
        throw new Error("La base activa es de solo lectura o una réplica");
    }
    const [company, sourceStore, targetStore, actor, walletBefore] = await Promise.all([
        prisma.company.findUnique({ where: { id: receipt.company.id }, select: { id: true, name: true, isActive: true } }),
        prisma.store.findUnique({
            where: { id: receipt.sourceStore.id },
            select: { id: true, name: true, code: true, address: true, companyId: true, isActive: true },
        }),
        prisma.store.findUnique({
            where: { id: receipt.targetStore.id },
            select: { id: true, name: true, code: true, address: true, companyId: true, isActive: true },
        }),
        prisma.user.findUnique({
            where: { id: receipt.actor.id },
            select: { id: true, email: true, name: true, role: true, companyId: true, storeId: true, isActive: true },
        }),
        prisma.wallet.findUnique({ where: { companyId: receipt.company.id }, select: { id: true, currency: true, balance: true } }),
    ]);
    if (!company?.isActive || company.name !== receipt.company.name) throw new Error("La compañía cambió después del plan");
    if (
        !sourceStore?.isActive
        || sourceStore.companyId !== company.id
        || sourceStore.name !== receipt.sourceStore.name
        || sourceStore.code !== receipt.sourceStore.code
        || sourceStore.address !== receipt.sourceStore.address
    ) throw new Error("La sede origen cambió después del plan");
    if (
        !targetStore?.isActive
        || targetStore.companyId !== company.id
        || targetStore.name !== receipt.targetStore.name
        || targetStore.code !== receipt.targetStore.code
        || targetStore.address !== receipt.targetStore.address
    ) throw new Error("La sede destino cambió después del plan");
    if (!actor?.isActive || !PLATFORM_ROLES.has(actor.role) || actor.email !== receipt.actor.email) {
        throw new Error("El actor del plan ya no es un administrador de plataforma activo");
    }
    if (!walletBefore || walletBefore.id !== receipt.walletControl.id || walletBefore.currency !== receipt.walletControl.currency) {
        throw new Error("La wallet de la compañía cambió después del plan");
    }

    const transactionsBefore = await transactionSnapshots(receipt.eligible.map((purchase) => purchase.id));
    for (const planned of receipt.eligible) {
        if (canonical(transactionsBefore.get(planned.id) ?? []) !== canonical(planned.transactions)) {
            throw new Error(`Los movimientos financieros de ${planned.id} cambiaron después del plan; genera uno nuevo`);
        }
    }

    const results: Array<{ purchaseId: string; changed: boolean }> = [];
    try {
        for (const planned of receipt.eligible) {
            const current = await prisma.codePurchase.findUnique({
                where: { id: planned.id },
                select: {
                    id: true,
                    companyId: true,
                    storeId: true,
                    status: true,
                    diemRequestId: true,
                    purchaseOriginPhoneId: true,
                    originLabelSnapshot: true,
                    purchaseOriginPhone: { select: { phone: true } },
                },
            });
            if (!current) throw new Error(`La compra ${planned.id} ya no existe`);
            if (current.companyId !== company.id || current.status !== "COMPLETED" || current.diemRequestId !== planned.diemRequestId) {
                throw new Error(`La compra ${planned.id} cambió de compañía, estado o referencia remota`);
            }
            const currentOrigin = purchaseOriginSnapshot(current);
            const alreadyCorrect = current.storeId === targetStore.id && current.purchaseOriginPhoneId === null;
            if (!alreadyCorrect && canonical(currentOrigin) !== canonical(planned.currentOrigin)) {
                throw new Error(`El origen de ${planned.id} cambió después del plan`);
            }
            const correction = await applyPurchaseOriginCorrection({
                actor,
                purchaseId: planned.id,
                origin: { kind: "store", id: targetStore.id },
                reason,
                idempotencyKey: `origin-repair:${receipt.fingerprint.slice(0, 12)}:${planned.id}`,
            });
            results.push({ purchaseId: planned.id, changed: correction.changed });
        }

        const transactionsAfter = await transactionSnapshots(receipt.eligible.map((purchase) => purchase.id));
        for (const planned of receipt.eligible) {
            if (canonical(transactionsAfter.get(planned.id) ?? []) !== canonical(transactionsBefore.get(planned.id) ?? [])) {
                throw new Error(`Los movimientos financieros de ${planned.id} cambiaron durante la corrección`);
            }
        }
        const walletAfter = await prisma.wallet.findUniqueOrThrow({
            where: { companyId: company.id },
            select: { id: true, currency: true, balance: true },
        });
        writePrivate(reportPath, {
            version: VERSION,
            appliedAt: new Date().toISOString(),
            receiptFingerprint: receipt.fingerprint,
            database: identity.database,
            company: receipt.company,
            targetStore: receipt.targetStore,
            results,
            financialControl: {
                walletBefore,
                walletAfter,
                affectedTransactionsUnchanged: true,
                balanceChangedDuringRun: walletBefore.balance !== walletAfter.balance,
            },
        });
        console.log(JSON.stringify({ results, walletBefore, walletAfter, affectedTransactionsUnchanged: true }, null, 2));
        console.log("APPLY OK: orígenes corregidos mediante el servicio; movimientos financieros intactos.");
    } catch (error) {
        writePrivate(reportPath, {
            version: VERSION,
            failedAt: new Date().toISOString(),
            receiptFingerprint: receipt.fingerprint,
            database: identity.database,
            results,
            error: error instanceof Error ? error.message : String(error),
            retry: "Corrige la causa y repite con el mismo recibo; las claves de idempotencia son estables.",
        });
        throw error;
    }
}

async function main() {
    const mode = process.argv[2];
    if (mode === "plan") return plan();
    if (mode === "apply") return apply();
    throw new Error("Uso: correct-store-purchase-origins.ts <plan|apply> ...");
}

main()
    .catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
