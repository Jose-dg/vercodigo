/**
 * Reverses one specific store split using the immutable receipt produced by
 * ops:split-store. It rejoins the store, its original purchases and their
 * wallet movements to the original company. The temporary company and wallet
 * are retained for review; this command never deletes data.
 *
 *   npm run ops:reverse-store-split -- plan \
 *     --split-receipt .secure/split-palacio-193/receipt.json \
 *     --actor-user <id> --store-name "Laboratorio Clínica del Play 193" \
 *     --out .secure/rejoin-palacio-193
 *   npm run ops:reverse-store-split -- apply \
 *     --receipt .secure/rejoin-palacio-193/receipt.json \
 *     --expected-database <name>
 */
import { createHash } from "node:crypto";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { summarizeCodeDelivery } from "@/lib/codes/delivery-counts";
import {
    auditStoreMergeBilling,
    planStoreMerge,
    type LedgerCursor,
    type StoreMergeBillingAudit,
    type StoreMergePlan,
    type StoreSplitPlan,
} from "@/lib/wallet/store-split";
import { assertLedgerConsistent, lockWalletAccounting, rebuildWalletLedger } from "@/services/wallet/ledger-write";

type Db = Prisma.TransactionClient | typeof prisma;
type StoreRename = { name: string | null; address: string | null };

type SplitReceipt = {
    version: 1;
    storeId: string;
    sourceCompanyId: string;
    sourceWalletId: string;
    actorUserId: string;
    company: { name: string; taxId: string; email: string; phone: string; address: string | null };
    storeRename: StoreRename;
    plan: StoreSplitPlan;
    fingerprint: string;
};

type MergeReceipt = {
    version: 1;
    priorSplitReceiptSha256: string;
    priorSplit: SplitReceipt;
    storeId: string;
    sourceCompanyId: string;
    sourceWalletId: string;
    targetCompanyId: string;
    targetWalletId: string;
    actorUserId: string;
    storeRename: StoreRename;
    plan: StoreMergePlan;
    billing: StoreMergeBillingAudit;
    fingerprint: string;
};

const sha = (value: string) => createHash("sha256").update(value).digest("hex");

function args() {
    const [mode, ...rest] = process.argv.slice(2);
    if (mode !== "plan" && mode !== "apply") throw new Error("Uso: ops:reverse-store-split <plan|apply> ...");
    const values = new Map<string, string>();
    for (let i = 0; i < rest.length; i += 2) values.set(rest[i].replace(/^--/, ""), rest[i + 1]);
    const required = mode === "plan"
        ? ["split-receipt", "actor-user", "store-name", "out"]
        : ["receipt", "expected-database"];
    for (const key of required) if (!values.get(key)?.trim()) throw new Error(`Falta --${key}`);
    return { mode, values } as const;
}

function readJson<T>(path: string): { raw: string; value: T } {
    const raw = readFileSync(resolve(path), "utf8");
    return { raw, value: JSON.parse(raw) as T };
}

function privateJson(path: string, payload: unknown) {
    const target = resolve(path);
    mkdirSync(resolve(target, ".."), { recursive: true, mode: 0o700 });
    writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
    chmodSync(target, 0o600);
}

const sorted = (values: string[]) => [...values].sort();

function fingerprintRow<T extends { balanceAfter: number | null }>(row: T) {
    const result: Partial<T> = { ...row };
    delete result.balanceAfter;
    return result;
}

function assertSameIds(label: string, actual: string[], expected: string[]) {
    if (JSON.stringify(sorted(actual)) !== JSON.stringify(sorted(expected))) {
        throw new Error(`${label} cambiaron desde la separación; esperado [${sorted(expected).join(", ")}], actual [${sorted(actual).join(", ")}]`);
    }
}

function compareLedgerOrder(a: LedgerCursor, b: LedgerCursor) {
    return a.occurredAt.getTime() - b.occurredAt.getTime()
        || a.occurredSequence - b.occurredSequence
        || a.id.localeCompare(b.id);
}

function latestTargetStatementCursor(params: {
    latestStatement: { lines: Array<{ walletTransactionId: string; occurredAt: Date; walletTransaction: { occurredSequence: number } }> } | null;
    targetRows: Array<{ id: string; type: string; status: string; occurredAt: Date; occurredSequence: number }>;
}): LedgerCursor | null {
    if (params.latestStatement) {
        const last = params.latestStatement.lines[0];
        if (!last) throw new Error("El último estado de cuenta destino no tiene línea de cierre");
        return { id: last.walletTransactionId, occurredAt: last.occurredAt, occurredSequence: last.walletTransaction.occurredSequence };
    }
    const confirmed = params.targetRows.filter((row) => row.status === "CONFIRMED");
    const openings = confirmed.filter((row) => row.type === "OPENING_BALANCE");
    const candidates = openings.length ? openings : confirmed.filter((row) => row.type === "RECHARGE");
    return candidates.length ? [...candidates].sort(compareLedgerOrder).at(-1)! : null;
}

async function snapshot(db: Db, storeId: string, targetCompanyId: string, targetWalletId: string) {
    const store = await db.store.findUnique({
        where: { id: storeId },
        select: {
            id: true,
            name: true,
            address: true,
            companyId: true,
            company: { select: { id: true, name: true, taxId: true } },
            _count: { select: { users: true, purchaseOriginPhones: true, authorizedPhones: true, invoiceItems: true, cards: true } },
        },
    });
    if (!store) throw new Error("La sede del recibo original no existe");
    const [sourceWallet, targetCompany, targetWallet] = await Promise.all([
        db.wallet.findUnique({ where: { companyId: store.companyId } }),
        db.company.findUnique({ where: { id: targetCompanyId }, select: { id: true, name: true } }),
        db.wallet.findUnique({ where: { id: targetWalletId } }),
    ]);
    if (!sourceWallet) throw new Error("La empresa actual de la sede no tiene wallet");
    if (!targetCompany || !targetWallet || targetWallet.companyId !== targetCompany.id) {
        throw new Error("La compañía o wallet original del recibo ya no coincide");
    }
    const [purchaseRows, foreignPurchases, activations, sourceRows, targetRows, sourceStatements, latestTargetStatement] = await Promise.all([
        db.codePurchase.findMany({
            where: { storeId, companyId: store.companyId },
            orderBy: { id: "asc" },
            select: {
                id: true,
                status: true,
                count: true,
                totalAmount: true,
                currency: true,
                deliveredCodes: true,
                diemRequestId: true,
            },
        }),
        db.codePurchase.count({ where: { storeId, companyId: { not: store.companyId } } }),
        db.cardActivation.findMany({ where: { storeId }, orderBy: { id: "asc" }, select: { id: true } }),
        db.walletTransaction.findMany({
            where: { walletId: sourceWallet.id },
            orderBy: [{ occurredAt: "asc" }, { occurredSequence: "asc" }, { id: "asc" }],
            select: {
                id: true, type: true, status: true, amount: true, balanceAfter: true,
                occurredAt: true, occurredSequence: true, codePurchaseId: true,
                cardActivationId: true, reversalOfId: true,
                accountStatementLine: { select: { id: true } },
            },
        }),
        db.walletTransaction.findMany({
            where: { walletId: targetWallet.id },
            orderBy: [{ occurredAt: "asc" }, { occurredSequence: "asc" }, { id: "asc" }],
            select: { id: true, type: true, status: true, amount: true, balanceAfter: true, occurredAt: true, occurredSequence: true },
        }),
        db.accountStatement.findMany({
            where: { walletId: sourceWallet.id },
            orderBy: [{ periodEnd: "asc" }, { issuedAt: "asc" }],
            select: { statementNumber: true, periodStart: true, periodEnd: true },
        }),
        db.accountStatement.findFirst({
            where: { walletId: targetWallet.id },
            orderBy: [{ periodEnd: "desc" }, { issuedAt: "desc" }],
            select: {
                statementNumber: true,
                periodEnd: true,
                lines: {
                    orderBy: { position: "desc" },
                    take: 1,
                    select: {
                        walletTransactionId: true,
                        occurredAt: true,
                        walletTransaction: { select: { occurredSequence: true } },
                    },
                },
            },
        }),
    ]);
    const purchases = purchaseRows.map((purchase) => ({
        id: purchase.id,
        status: purchase.status,
        count: purchase.count,
        totalAmount: purchase.totalAmount,
        currency: purchase.currency,
        diemRequestId: purchase.diemRequestId,
        deliveredCodeCount: summarizeCodeDelivery({
            status: purchase.status,
            billedCount: purchase.count,
            deliveredCodes: purchase.deliveredCodes,
        }).deliveredCodeCount,
    }));
    const targetStatementCursor = latestTargetStatementCursor({ latestStatement: latestTargetStatement, targetRows });
    return {
        store,
        sourceWallet,
        targetCompany,
        targetWallet,
        purchases,
        foreignPurchases,
        activations,
        sourceRows,
        targetRows,
        sourceStatements,
        latestTargetStatement,
        targetStatementCursor,
    };
}

function buildPlan(snap: Awaited<ReturnType<typeof snapshot>>, prior: SplitReceipt): {
    plan: StoreMergePlan;
    billing: StoreMergeBillingAudit;
    fingerprint: string;
} {
    if (prior.version !== 1 || prior.storeId !== snap.store.id) throw new Error("El recibo original no corresponde a esta sede");
    if (snap.store.companyId === prior.sourceCompanyId) throw new Error("La sede ya pertenece a la compañía original");
    if (snap.store.company.taxId !== prior.company.taxId || snap.store.company.name !== prior.company.name) {
        throw new Error("La empresa actual de la sede no es la empresa creada por la separación original");
    }
    if (snap.sourceWallet.currency !== snap.targetWallet.currency) throw new Error("Las wallets usan monedas diferentes");
    const blockers = Object.entries(snap.store._count).filter(([key, count]) => key !== "cards" && count > 0);
    if (blockers.length) {
        throw new Error(`La sede tiene ${blockers.map(([key, count]) => `${count} ${key}`).join(", ")}; requieren una regla explícita antes de reunirla`);
    }
    if (snap.foreignPurchases) throw new Error("La sede ya tiene compras atribuidas a otra empresa");
    assertSameIds("Las compras de la sede", snap.purchases.map(({ id }) => id), prior.plan.purchaseIds);
    assertSameIds("Las activaciones de la sede", snap.activations.map(({ id }) => id), prior.plan.activationIds);

    const sourceRows = snap.sourceRows.map(({ accountStatementLine, ...row }) => ({ ...row, inStatement: accountStatementLine !== null }));
    const billing = auditStoreMergeBilling({
        purchases: snap.purchases,
        sourceRows,
        walletCurrency: snap.sourceWallet.currency,
    });
    const plan = planStoreMerge({
        purchases: snap.purchases,
        activationIds: snap.activations.map(({ id }) => id),
        sourceRows,
        sourceBalance: snap.sourceWallet.balance,
        targetRows: snap.targetRows,
        targetBalance: snap.targetWallet.balance,
        targetClosedThrough: snap.latestTargetStatement?.periodEnd,
        sourceClosedPeriods: snap.sourceStatements,
        targetStatementCursor: snap.targetStatementCursor,
        requiredTargetStatementMovementIds: billing.statementChargeMovementIds,
    });
    const moved = new Set(plan.movementIds);
    const missingOriginalMovement = prior.plan.movementIds.find((id) => !moved.has(id));
    if (missingOriginalMovement) throw new Error(`El movimiento original ${missingOriginalMovement} ya no está en la wallet separada`);

    const fingerprint = sha(JSON.stringify({
        storeCompanyId: snap.store.companyId,
        source: { id: snap.sourceWallet.id, balance: snap.sourceWallet.balance, currency: snap.sourceWallet.currency },
        target: { id: snap.targetWallet.id, balance: snap.targetWallet.balance, currency: snap.targetWallet.currency },
        purchases: snap.purchases,
        activations: snap.activations,
        sourceRows: sourceRows.map(fingerprintRow),
        targetRows: snap.targetRows.map(fingerprintRow),
        sourceStatements: snap.sourceStatements,
        targetClosedThrough: snap.latestTargetStatement?.periodEnd ?? null,
        targetStatementCursor: snap.targetStatementCursor,
    }));
    return { plan, billing, fingerprint };
}

async function plan(values: Map<string, string>) {
    const priorFile = readJson<SplitReceipt>(values.get("split-receipt")!);
    const prior = priorFile.value;
    const actor = await prisma.user.findUnique({
        where: { id: values.get("actor-user")! },
        select: { id: true, role: true, isActive: true },
    });
    if (!actor?.isActive || !["SUPER_ADMIN", "SYSTEM_ADMIN"].includes(actor.role)) {
        throw new Error("--actor-user debe ser un administrador de plataforma activo");
    }
    const snap = await snapshot(prisma, prior.storeId, prior.sourceCompanyId, prior.sourceWalletId);
    const current = buildPlan(snap, prior);
    const receipt: MergeReceipt = {
        version: 1,
        priorSplitReceiptSha256: sha(JSON.stringify(prior)),
        priorSplit: prior,
        storeId: prior.storeId,
        sourceCompanyId: snap.store.companyId,
        sourceWalletId: snap.sourceWallet.id,
        targetCompanyId: prior.sourceCompanyId,
        targetWalletId: prior.sourceWalletId,
        actorUserId: actor.id,
        storeRename: {
            name: values.get("store-name")!.trim(),
            address: values.get("store-address")?.trim() || null,
        },
        plan: current.plan,
        billing: current.billing,
        fingerprint: current.fingerprint,
    };
    privateJson(join(values.get("out")!, "receipt.json"), receipt);
    console.log(JSON.stringify({
        store: snap.store.name,
        from: snap.store.company.name,
        to: snap.targetCompany.name,
        storeRename: receipt.storeRename,
        cards: snap.store._count.cards,
        purchases: receipt.plan.purchaseIds.length,
        activations: receipt.plan.activationIds.length,
        movements: receipt.plan.movementIds.length,
        movedAmount: receipt.plan.movedAmount,
        billing: receipt.billing,
        currency: snap.sourceWallet.currency,
        sourceBalance: receipt.plan.source,
        targetBalance: receipt.plan.target,
    }, null, 2));
    console.log("PLAN OK: sin cambios.");
}

async function apply(values: Map<string, string>) {
    const databases = await prisma.$queryRaw<Array<{ current_database: string }>>`SELECT current_database()`;
    if (databases[0]?.current_database !== values.get("expected-database")) {
        throw new Error("--expected-database no coincide con la base activa");
    }
    const receipt = readJson<MergeReceipt>(values.get("receipt")!).value;
    if (receipt.version !== 1) throw new Error("Versión de recibo no soportada");
    if (sha(JSON.stringify(receipt.priorSplit)) !== receipt.priorSplitReceiptSha256) {
        throw new Error("El recibo de separación incluido fue alterado");
    }
    if (receipt.priorSplit.storeId !== receipt.storeId
        || receipt.priorSplit.sourceCompanyId !== receipt.targetCompanyId
        || receipt.priorSplit.sourceWalletId !== receipt.targetWalletId) {
        throw new Error("El recibo de reversión no coincide con la separación original");
    }

    const result = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`split-store:${receipt.storeId}`}))`;
        const store = await tx.store.findUniqueOrThrow({ where: { id: receipt.storeId }, select: { companyId: true } });
        if (store.companyId === receipt.targetCompanyId) {
            const [purchases, movements] = await Promise.all([
                tx.codePurchase.count({ where: { id: { in: receipt.plan.purchaseIds }, companyId: receipt.targetCompanyId } }),
                tx.walletTransaction.count({ where: { id: { in: receipt.plan.movementIds }, walletId: receipt.targetWalletId } }),
            ]);
            if (purchases !== receipt.plan.purchaseIds.length || movements !== receipt.plan.movementIds.length) {
                throw new Error("La sede ya volvió, pero su historial no coincide con el recibo");
            }
            return { changed: false };
        }
        if (store.companyId !== receipt.sourceCompanyId) throw new Error("La sede ya no pertenece a la empresa del plan");
        await lockWalletAccounting(tx, [receipt.sourceWalletId, receipt.targetWalletId]);
        for (const walletId of sorted([receipt.sourceWalletId, receipt.targetWalletId])) {
            await tx.$queryRaw`SELECT "id" FROM "Wallet" WHERE "id" = ${walletId} FOR UPDATE`;
        }
        const prior = await tx.auditLog.findFirst({
            where: { action: "STORE_SPLIT_TO_COMPANY", storeId: receipt.storeId, companyId: receipt.sourceCompanyId },
            orderBy: { createdAt: "desc" },
            select: { details: true },
        });
        if (!prior) throw new Error("No existe la auditoría de la separación original");
        const snap = await snapshot(tx, receipt.storeId, receipt.targetCompanyId, receipt.targetWalletId);
        const current = buildPlan(snap, receipt.priorSplit);
        if (current.fingerprint !== receipt.fingerprint
            || JSON.stringify(current.plan) !== JSON.stringify(receipt.plan)
            || JSON.stringify(current.billing) !== JSON.stringify(receipt.billing)) {
            throw new Error("La sede o alguna wallet cambiaron después del plan; vuelve a correr plan");
        }

        const storeBefore = { name: snap.store.name, address: snap.store.address, companyId: snap.store.companyId };
        await tx.store.update({
            where: { id: receipt.storeId },
            data: {
                companyId: receipt.targetCompanyId,
                ...(receipt.storeRename.name ? { name: receipt.storeRename.name } : {}),
                ...(receipt.storeRename.address ? { address: receipt.storeRename.address } : {}),
            },
            select: { id: true },
        });
        const purchases = await tx.codePurchase.updateMany({
            where: { id: { in: current.plan.purchaseIds }, companyId: receipt.sourceCompanyId },
            data: { companyId: receipt.targetCompanyId },
        });
        const movements = await tx.walletTransaction.updateMany({
            where: { id: { in: current.plan.movementIds }, walletId: receipt.sourceWalletId },
            data: { walletId: receipt.targetWalletId },
        });
        if (purchases.count !== current.plan.purchaseIds.length || movements.count !== current.plan.movementIds.length) {
            throw new Error("No se movieron exactamente las filas del plan");
        }
        const sourceBalance = await rebuildWalletLedger(tx, receipt.sourceWalletId);
        const targetBalance = await rebuildWalletLedger(tx, receipt.targetWalletId);
        await assertLedgerConsistent(tx, receipt.sourceWalletId, sourceBalance);
        await assertLedgerConsistent(tx, receipt.targetWalletId, targetBalance);
        if (Math.abs(sourceBalance - current.plan.source.balanceAfter) > 0.005
            || Math.abs(targetBalance - current.plan.target.balanceAfter) > 0.005) {
            throw new Error("Los saldos resultantes no coinciden con el plan");
        }
        await tx.auditLog.create({
            data: {
                action: "STORE_SPLIT_REVERSED",
                userId: receipt.actorUserId,
                companyId: receipt.targetCompanyId,
                storeId: receipt.storeId,
                entityType: "Store",
                entityId: receipt.storeId,
                before: { ...storeBefore, walletId: receipt.sourceWalletId, balance: current.plan.source.balanceBefore },
                after: {
                    companyId: receipt.targetCompanyId,
                    walletId: receipt.targetWalletId,
                    balance: targetBalance,
                    sourceBalance,
                    storeRename: receipt.storeRename,
                },
                details: {
                    version: receipt.version,
                    priorSplitReceiptSha256: receipt.priorSplitReceiptSha256,
                    originalAuditDetails: prior.details ?? null,
                    fingerprint: receipt.fingerprint,
                    purchaseIds: current.plan.purchaseIds,
                    activationIds: current.plan.activationIds,
                    movementIds: current.plan.movementIds,
                    billing: current.billing,
                    sourceCompanyRetained: true,
                },
            },
            select: { id: true },
        });
        return { changed: true };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 60_000 });

    const [source, target] = await Promise.all([
        prisma.wallet.findUniqueOrThrow({ where: { id: receipt.sourceWalletId }, select: { balance: true } }),
        prisma.wallet.findUniqueOrThrow({ where: { id: receipt.targetWalletId }, select: { balance: true } }),
    ]);
    console.log(JSON.stringify({ changed: result.changed, sourceBalance: source.balance, targetBalance: target.balance }, null, 2));
    console.log(result.changed
        ? "APPLY OK: sede, compras y movimientos reunidos. La empresa separada quedó intacta para revisión."
        : "APPLY NO-OP: la sede y su historial ya pertenecían a la compañía original.");
}

async function main() {
    const { mode, values } = args();
    if (mode === "plan") await plan(values);
    else await apply(values);
}

main()
    .catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
