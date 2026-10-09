/**
 * Audited, ORM-only repair for duplicate wallet movements linked to one code purchase.
 *
 * The repair preserves the extra row as FAILED audit evidence, detaches it from
 * the purchase, and rebuilds the affected wallets from their latest opening balance.
 */
import { createHash } from "node:crypto";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { Prisma, PrismaClient, UserRole } from "@prisma/client";
import { rebuildBalances } from "../src/lib/wallet/ledger";
import { runSerializableTransaction } from "../src/lib/prisma-transaction";

const prisma = new PrismaClient();
const REPAIR_VERSION = 1;
const PLATFORM_ROLES = new Set<UserRole>([UserRole.SUPER_ADMIN, UserRole.SYSTEM_ADMIN]);

type Db = Prisma.TransactionClient | PrismaClient;
type Args = {
    mode: "plan" | "apply";
    receipt: string;
    backup?: string;
    report?: string;
    expectedDatabase?: string;
    actorEmail?: string;
};

const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const canonical = (value: unknown): string => value instanceof Date
    ? JSON.stringify(value.toISOString())
    : Array.isArray(value)
        ? `[${value.map(canonical).join(",")}]`
        : value && typeof value === "object"
            ? `{${Object.entries(value as Record<string, unknown>)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
                .join(",")}}`
            : JSON.stringify(value);

function parseArgs(): Args {
    const [mode, ...rest] = process.argv.slice(2);
    if (mode !== "plan" && mode !== "apply") {
        throw new Error("Uso: repair:duplicate-consumptions <plan|apply> --receipt <ruta> [...]");
    }
    const values = new Map<string, string>();
    for (let index = 0; index < rest.length; index += 2) {
        const key = rest[index]?.replace(/^--/, "");
        const value = rest[index + 1];
        if (!key || !value) throw new Error("Los argumentos deben enviarse como --clave valor");
        values.set(key, value);
    }
    const receipt = values.get("receipt");
    if (!receipt) throw new Error("Falta --receipt");
    if (mode === "apply") {
        for (const key of ["backup", "report", "expected-database", "actor-email"]) {
            if (!values.get(key)) throw new Error(`apply exige --${key}`);
        }
    }
    return {
        mode,
        receipt,
        backup: values.get("backup"),
        report: values.get("report"),
        expectedDatabase: values.get("expected-database"),
        actorEmail: values.get("actor-email"),
    };
}

function writePrivateJson(path: string, payload: unknown) {
    const target = resolve(path);
    mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
    writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
    chmodSync(target, 0o600);
}

function configuredDatabaseName() {
    const configured = process.env.DATABASE_URL?.trim();
    if (!configured) throw new Error("DATABASE_URL no está configurada");
    return decodeURIComponent(new URL(configured).pathname.replace(/^\//, ""));
}

async function duplicatePurchaseIds(db: Db) {
    const groups = await db.walletTransaction.groupBy({
        by: ["codePurchaseId"],
        where: { codePurchaseId: { not: null } },
        _count: { _all: true },
        having: { codePurchaseId: { _count: { gt: 1 } } },
    });
    return groups.flatMap((row) => row.codePurchaseId ? [row.codePurchaseId] : []).sort();
}

async function snapshot(db: Db = prisma) {
    const purchaseIds = await duplicatePurchaseIds(db);
    const [purchases, transactions, corrections] = await Promise.all([
        db.codePurchase.findMany({
            where: { id: { in: purchaseIds } },
            select: {
                id: true,
                companyId: true,
                status: true,
                totalAmount: true,
                diemRequestId: true,
                occurredAt: true,
            },
            orderBy: { id: "asc" },
        }),
        db.walletTransaction.findMany({
            where: { codePurchaseId: { in: purchaseIds } },
            select: {
                id: true,
                walletId: true,
                codePurchaseId: true,
                type: true,
                status: true,
                amount: true,
                balanceAfter: true,
                originalAmount: true,
                originalCurrency: true,
                exchangeRate: true,
                description: true,
                occurredAt: true,
                occurredSequence: true,
                createdAt: true,
                accountStatementLine: { select: { id: true, accountStatementId: true } },
            },
            orderBy: [{ codePurchaseId: "asc" }, { occurredAt: "asc" }, { occurredSequence: "asc" }, { id: "asc" }],
        }),
        db.salePriceCorrection.findMany({
            where: { targetType: "CODE_PURCHASE", targetId: { in: purchaseIds }, status: "COMPLETED" },
            select: { targetId: true, walletTransactionId: true, completedAt: true },
            orderBy: [{ completedAt: "desc" }, { id: "desc" }],
        }),
    ]);
    const correctionKeeper = new Map<string, string>();
    for (const correction of corrections) {
        if (!correctionKeeper.has(correction.targetId)) {
            correctionKeeper.set(correction.targetId, correction.walletTransactionId);
        }
    }
    const groups = purchaseIds.map((purchaseId) => {
        const rows = transactions.filter((row) => row.codePurchaseId === purchaseId);
        const preferredId = correctionKeeper.get(purchaseId);
        const keeper = rows.find((row) => row.id === preferredId) ?? rows[0];
        return {
            purchase: purchases.find((row) => row.id === purchaseId) ?? null,
            keeper,
            duplicates: rows.filter((row) => row.id !== keeper?.id),
        };
    });
    const walletIds = [...new Set(transactions.map((row) => row.walletId))].sort();
    const wallets = await db.wallet.findMany({
        where: { id: { in: walletIds } },
        select: { id: true, companyId: true, balance: true, currency: true },
        orderBy: { id: "asc" },
    });
    const safe = { version: REPAIR_VERSION, groups, wallets };
    return { ...safe, fingerprint: sha(canonical(safe)) };
}

function validateSnapshot(snap: Awaited<ReturnType<typeof snapshot>>) {
    for (const group of snap.groups) {
        if (!group.purchase || group.purchase.status !== "COMPLETED" || !group.purchase.diemRequestId) {
            throw new Error(`Compra duplicada inválida: ${group.purchase?.id ?? "desconocida"}`);
        }
        if (!group.keeper || group.duplicates.length < 1) {
            throw new Error(`Grupo duplicado incompleto: ${group.purchase.id}`);
        }
        const rows = [group.keeper, ...group.duplicates];
        if (new Set(rows.map((row) => row.walletId)).size !== 1 || rows.some((row) => row.type !== "CONSUMPTION")) {
            throw new Error(`El grupo ${group.purchase.id} no contiene únicamente consumos de una wallet`);
        }
        if (rows.some((row) => row.accountStatementLine)) {
            throw new Error(`El grupo ${group.purchase.id} pertenece a un estado de cuenta emitido`);
        }
    }
}

async function projectWallets(snap: Awaited<ReturnType<typeof snapshot>>, db: Db = prisma) {
    const duplicateIds = new Set(snap.groups.flatMap((group) => group.duplicates.map((row) => row.id)));
    const projections = [];
    for (const wallet of snap.wallets) {
        const rows = await db.walletTransaction.findMany({ where: { walletId: wallet.id } });
        const rebuilt = rebuildBalances(rows.map((row) => ({
            ...row,
            status: duplicateIds.has(row.id) ? "FAILED" : row.status,
        })));
        projections.push({
            walletId: wallet.id,
            companyId: wallet.companyId,
            previousBalance: wallet.balance,
            projectedBalance: rebuilt.balance,
            difference: Math.round((rebuilt.balance - wallet.balance) * 100) / 100,
        });
    }
    return projections;
}

async function applyRepair(expectedFingerprint: string, actorEmail: string) {
    return runSerializableTransaction(prisma, async (tx) => {
        const actor = await tx.user.findUnique({
            where: { email: actorEmail.trim().toLowerCase() },
            select: { id: true, role: true, isActive: true },
        });
        if (!actor?.isActive || !PLATFORM_ROLES.has(actor.role)) {
            throw new Error("El actor debe ser un administrador de plataforma activo");
        }
        const current = await snapshot(tx);
        validateSnapshot(current);
        if (current.fingerprint !== expectedFingerprint) {
            throw new Error("La base cambió después del plan; genera un plan nuevo");
        }
        if (!current.groups.length) return { changed: false, repaired: 0, projections: [] };

        for (const group of current.groups) {
            for (const duplicate of group.duplicates) {
                const changed = await tx.walletTransaction.updateMany({
                    where: { id: duplicate.id, codePurchaseId: group.purchase!.id },
                    data: { status: "FAILED", balanceAfter: null, codePurchaseId: null },
                });
                if (changed.count !== 1) throw new Error(`Cambió el movimiento ${duplicate.id}`);
                await tx.auditLog.create({
                    data: {
                        action: "DUPLICATE_WALLET_CONSUMPTION_REPAIRED",
                        userId: actor.id,
                        companyId: group.purchase!.companyId,
                        entityType: "WalletTransaction",
                        entityId: duplicate.id,
                        before: {
                            status: duplicate.status,
                            amount: duplicate.amount,
                            balanceAfter: duplicate.balanceAfter,
                            codePurchaseId: group.purchase!.id,
                        },
                        after: { status: "FAILED", balanceAfter: null, codePurchaseId: null },
                        details: {
                            version: REPAIR_VERSION,
                            keptWalletTransactionId: group.keeper!.id,
                            reason: "Concurrent fulfillment created more than one wallet consumption",
                        },
                    },
                });
            }
        }

        const finalBalances = [];
        for (const wallet of current.wallets) {
            const rows = await tx.walletTransaction.findMany({ where: { walletId: wallet.id } });
            const rebuilt = rebuildBalances(rows);
            for (const [id, balanceAfter] of rebuilt.balances) {
                await tx.walletTransaction.update({ where: { id }, data: { balanceAfter } });
            }
            await tx.wallet.update({ where: { id: wallet.id }, data: { balance: rebuilt.balance } });
            finalBalances.push({ walletId: wallet.id, companyId: wallet.companyId, balance: rebuilt.balance });
        }
        const remaining = await duplicatePurchaseIds(tx);
        if (remaining.length) throw new Error(`Persisten relaciones duplicadas: ${remaining.join(", ")}`);
        return {
            changed: true,
            repaired: current.groups.reduce((sum, group) => sum + group.duplicates.length, 0),
            finalBalances,
        };
    }, { maxWaitMs: 10_000, timeoutMs: 60_000 });
}

async function main() {
    const args = parseArgs();
    const before = await snapshot();
    validateSnapshot(before);
    const projections = await projectWallets(before);
    const receipt = {
        version: REPAIR_VERSION,
        fingerprint: before.fingerprint,
        duplicatePurchases: before.groups.length,
        duplicateMovements: before.groups.reduce((sum, group) => sum + group.duplicates.length, 0),
        groups: before.groups.map((group) => ({
            purchaseId: group.purchase!.id,
            companyId: group.purchase!.companyId,
            diemRequestId: group.purchase!.diemRequestId,
            keeperId: group.keeper!.id,
            duplicateIds: group.duplicates.map((row) => row.id),
        })),
        projections,
    };
    if (args.mode === "plan") {
        writePrivateJson(args.receipt, receipt);
        console.log(JSON.stringify(receipt, null, 2));
        console.log("PLAN OK: solo ORM, sin PINes y sin cambios.");
        return;
    }
    if (configuredDatabaseName() !== args.expectedDatabase) {
        throw new Error("--expected-database no coincide con DATABASE_URL");
    }
    const planned = JSON.parse(readFileSync(resolve(args.receipt), "utf8"));
    if (canonical(planned) !== canonical(receipt)) throw new Error("El recibo no coincide con el estado actual");
    writePrivateJson(args.backup!, { capturedAt: new Date().toISOString(), ...before });
    const result = await applyRepair(before.fingerprint, args.actorEmail!);
    const after = await snapshot();
    if (after.groups.length) throw new Error("La verificación posterior todavía encontró duplicados");
    const report = { ...result, finalDuplicatePurchases: after.groups.length };
    writePrivateJson(args.report!, report);
    console.log(JSON.stringify(report, null, 2));
    console.log(result.changed ? "APPLY OK: duplicados reparados y saldos reconstruidos." : "APPLY NO-OP.");
}

main()
    .catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
