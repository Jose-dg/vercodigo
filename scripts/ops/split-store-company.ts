/**
 * Moves a store that became its own business out of its company: a new
 * company with its own wallet takes the store, its cards, and the store's
 * history (purchases, card activations and every wallet movement they
 * produced). Both ledgers are rebuilt; nothing is compensated.
 *
 *   1. plan  — read-only. Checks the store can move cleanly and writes a
 *              receipt with the exact rows and the resulting balances.
 *   2. apply — re-plans inside one serializable transaction, rejects any
 *              change since the plan, and moves the rows. Re-running it once
 *              applied is a no-op.
 *
 * The commercial account `diem-sas:<new company id>` must then be provisioned
 * in Diem (`manage.py provision_commercial_account`) before the new company
 * buys codes.
 *
 *   npm run ops:split-store -- plan --store <id> --name "<company>" --tax-id <nit> \
 *     --email <email> --phone <phone> [--address "<address>"] \
 *     [--store-name "<name>"] [--store-address "<address>"] --actor-user <id> --out <dir>
 *   npm run ops:split-store -- apply --receipt <dir>/receipt.json --expected-database <name>
 */
import { createHash } from "node:crypto";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { buildCommercialAccountCode } from "@/lib/devdiem/fulfillment";
import { planStoreSplit, type StoreSplitPlan } from "@/lib/wallet/store-split";
import { assertLedgerConsistent, rebuildWalletLedger } from "@/services/wallet/ledger-write";

type Db = Prisma.TransactionClient | typeof prisma;

type NewCompany = { name: string; taxId: string; email: string; phone: string; address: string | null };

/** Optional new identity of the store, applied in the same transaction. */
type StoreRename = { name: string | null; address: string | null };

type Receipt = {
    version: 1;
    storeId: string;
    sourceCompanyId: string;
    sourceWalletId: string;
    actorUserId: string;
    company: NewCompany;
    storeRename: StoreRename;
    plan: StoreSplitPlan;
    fingerprint: string;
};

const sha = (value: string) => createHash("sha256").update(value).digest("hex");

function args() {
    const [mode, ...rest] = process.argv.slice(2);
    if (mode !== "plan" && mode !== "apply") throw new Error("Uso: ops:split-store <plan|apply> ...");
    const values = new Map<string, string>();
    for (let i = 0; i < rest.length; i += 2) values.set(rest[i].replace(/^--/, ""), rest[i + 1]);
    const required = mode === "plan"
        ? ["store", "name", "tax-id", "email", "phone", "actor-user", "out"]
        : ["receipt", "expected-database"];
    for (const key of required) if (!values.get(key)?.trim()) throw new Error(`Falta --${key}`);
    return { mode, values } as const;
}

function privateJson(path: string, payload: unknown) {
    const target = resolve(path);
    mkdirSync(resolve(target, ".."), { recursive: true, mode: 0o700 });
    writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
    chmodSync(target, 0o600);
}

/** Everything the split reads, so apply can tell whether it changed after the plan. */
async function snapshot(db: Db, storeId: string) {
    const store = await db.store.findUnique({
        where: { id: storeId },
        select: {
            id: true,
            name: true,
            companyId: true,
            company: { select: { name: true, billingFrequency: true, commissionRate: true } },
            _count: { select: { users: true, purchaseOriginPhones: true, authorizedPhones: true, invoiceItems: true, cards: true } },
        },
    });
    if (!store) throw new Error("La sede no existe");
    const wallet = await db.wallet.findUnique({ where: { companyId: store.companyId } });
    if (!wallet) throw new Error("La empresa de la sede no tiene wallet");
    const [purchases, foreignPurchases, activations, rows] = await Promise.all([
        db.codePurchase.findMany({
            where: { storeId, companyId: store.companyId },
            orderBy: { id: "asc" },
            select: { id: true, status: true },
        }),
        db.codePurchase.count({ where: { storeId, companyId: { not: store.companyId } } }),
        db.cardActivation.findMany({ where: { storeId }, orderBy: { id: "asc" }, select: { id: true } }),
        db.walletTransaction.findMany({
            where: { walletId: wallet.id },
            orderBy: [{ occurredAt: "asc" }, { occurredSequence: "asc" }, { id: "asc" }],
            select: {
                id: true,
                type: true,
                status: true,
                amount: true,
                balanceAfter: true,
                occurredAt: true,
                occurredSequence: true,
                codePurchaseId: true,
                cardActivationId: true,
                reversalOfId: true,
                accountStatementLine: { select: { id: true } },
            },
        }),
    ]);
    return { store, wallet, purchases, foreignPurchases, activations, rows };
}

function buildPlan(snap: Awaited<ReturnType<typeof snapshot>>): { plan: StoreSplitPlan; fingerprint: string } {
    const { store, wallet } = snap;
    // Staff, numbers and invoices tied to the store would need their own rule.
    const blockers = Object.entries(store._count).filter(([key, count]) => key !== "cards" && count > 0);
    if (blockers.length) {
        throw new Error(`La sede tiene ${blockers.map(([key, count]) => `${count} ${key}`).join(", ")}; este comando no los mueve`);
    }
    if (snap.foreignPurchases) throw new Error("La sede tiene compras registradas en otra empresa");
    const sourceRows = snap.rows.map(({ accountStatementLine, ...row }) => ({ ...row, inStatement: accountStatementLine !== null }));
    const plan = planStoreSplit({
        purchases: snap.purchases,
        activationIds: snap.activations.map((activation) => activation.id),
        sourceRows,
        sourceBalance: wallet.balance,
    });
    const fingerprint = sha(JSON.stringify({
        storeCompanyId: store.companyId,
        balance: wallet.balance,
        currency: wallet.currency,
        purchases: snap.purchases,
        activations: snap.activations,
        rows: sourceRows.map(({ balanceAfter: _balanceAfter, ...row }) => row),
    }));
    return { plan, fingerprint };
}

async function plan(values: Map<string, string>) {
    const company: NewCompany = {
        name: values.get("name")!.trim(),
        taxId: values.get("tax-id")!.trim(),
        email: values.get("email")!.trim().toLowerCase(),
        phone: values.get("phone")!.trim(),
        address: values.get("address")?.trim() || null,
    };
    const storeRename: StoreRename = {
        name: values.get("store-name")?.trim() || null,
        address: values.get("store-address")?.trim() || null,
    };
    const actor = await prisma.user.findUnique({ where: { id: values.get("actor-user")! }, select: { id: true, role: true } });
    if (!actor || !["SUPER_ADMIN", "SYSTEM_ADMIN"].includes(actor.role)) {
        throw new Error("--actor-user debe ser un administrador de plataforma");
    }
    if (await prisma.company.findUnique({ where: { taxId: company.taxId }, select: { id: true } })) {
        throw new Error(`Ya existe una empresa con NIT ${company.taxId}`);
    }
    const snap = await snapshot(prisma, values.get("store")!);
    const { plan: split, fingerprint } = buildPlan(snap);

    const receipt: Receipt = {
        version: 1,
        storeId: snap.store.id,
        sourceCompanyId: snap.store.companyId,
        sourceWalletId: snap.wallet.id,
        actorUserId: actor.id,
        company,
        storeRename,
        plan: split,
        fingerprint,
    };
    privateJson(join(values.get("out")!, "receipt.json"), receipt);
    console.log(JSON.stringify({
        store: snap.store.name,
        from: snap.store.company.name,
        to: company,
        storeRename,
        cards: snap.store._count.cards,
        purchases: split.purchaseIds.length,
        activations: split.activationIds.length,
        movements: split.movementIds.length,
        movedAmount: split.movedAmount,
        currency: snap.wallet.currency,
        sourceBalance: split.source,
        newCompanyBalance: split.target.balanceAfter,
    }, null, 2));
    console.log("PLAN OK: sin cambios.");
}

async function apply(values: Map<string, string>) {
    const databases = await prisma.$queryRaw<Array<{ current_database: string }>>`SELECT current_database()`;
    if (databases[0]?.current_database !== values.get("expected-database")) {
        throw new Error("--expected-database no coincide con la base activa");
    }
    const receipt = JSON.parse(readFileSync(resolve(values.get("receipt")!), "utf8")) as Receipt;

    const result = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`split-store:${receipt.storeId}`}))`;
        const existing = await tx.company.findUnique({ where: { taxId: receipt.company.taxId }, select: { id: true } });
        const store = await tx.store.findUniqueOrThrow({ where: { id: receipt.storeId }, select: { companyId: true } });
        if (existing && store.companyId === existing.id) return { companyId: existing.id, changed: false };
        if (existing) throw new Error(`El NIT ${receipt.company.taxId} ya pertenece a otra empresa`);
        if (store.companyId !== receipt.sourceCompanyId) throw new Error("La sede ya no pertenece a la empresa del plan");

        await tx.$queryRaw`SELECT "id" FROM "Wallet" WHERE "id" = ${receipt.sourceWalletId} FOR UPDATE`;
        const current = buildPlan(await snapshot(tx, receipt.storeId));
        if (current.fingerprint !== receipt.fingerprint) {
            throw new Error("La sede o la wallet cambiaron después del plan; vuelve a correr plan");
        }
        const source = await tx.company.findUniqueOrThrow({
            where: { id: receipt.sourceCompanyId },
            select: { billingFrequency: true, commissionRate: true, wallet: { select: { currency: true } } },
        });
        const company = await tx.company.create({
            data: {
                ...receipt.company,
                billingFrequency: source.billingFrequency,
                commissionRate: source.commissionRate,
                wallet: { create: { currency: source.wallet!.currency } },
            },
            select: { id: true, wallet: { select: { id: true } } },
        });
        const targetWalletId = company.wallet!.id;

        const storeBefore = await tx.store.findUniqueOrThrow({ where: { id: receipt.storeId }, select: { name: true, address: true } });
        await tx.store.update({
            where: { id: receipt.storeId },
            data: {
                companyId: company.id,
                ...(receipt.storeRename.name ? { name: receipt.storeRename.name } : {}),
                ...(receipt.storeRename.address ? { address: receipt.storeRename.address } : {}),
            },
            select: { id: true },
        });
        const purchases = await tx.codePurchase.updateMany({
            where: { id: { in: current.plan.purchaseIds }, companyId: receipt.sourceCompanyId },
            data: { companyId: company.id },
        });
        const movements = await tx.walletTransaction.updateMany({
            where: { id: { in: current.plan.movementIds }, walletId: receipt.sourceWalletId },
            data: { walletId: targetWalletId },
        });
        if (purchases.count !== current.plan.purchaseIds.length || movements.count !== current.plan.movementIds.length) {
            throw new Error("No se movieron exactamente las filas del plan");
        }
        const sourceBalance = await rebuildWalletLedger(tx, receipt.sourceWalletId);
        const targetBalance = await rebuildWalletLedger(tx, targetWalletId);
        await assertLedgerConsistent(tx, receipt.sourceWalletId, sourceBalance);
        await assertLedgerConsistent(tx, targetWalletId, targetBalance);
        if (Math.abs(sourceBalance - current.plan.source.balanceAfter) > 0.005
            || Math.abs(targetBalance - current.plan.target.balanceAfter) > 0.005) {
            throw new Error("Los saldos resultantes no coinciden con el plan");
        }

        await tx.auditLog.create({
            data: {
                action: "STORE_SPLIT_TO_COMPANY",
                userId: receipt.actorUserId,
                companyId: company.id,
                storeId: receipt.storeId,
                entityType: "Store",
                entityId: receipt.storeId,
                before: { companyId: receipt.sourceCompanyId, walletId: receipt.sourceWalletId, balance: current.plan.source.balanceBefore, store: storeBefore },
                after: { companyId: company.id, walletId: targetWalletId, balance: targetBalance, sourceBalance, storeRename: receipt.storeRename },
                details: {
                    version: receipt.version,
                    fingerprint: receipt.fingerprint,
                    purchaseIds: current.plan.purchaseIds,
                    activationIds: current.plan.activationIds,
                    movementIds: current.plan.movementIds,
                },
            },
            select: { id: true },
        });
        return { companyId: company.id, changed: true };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 60_000 });

    const [source, target] = await Promise.all([
        prisma.wallet.findUniqueOrThrow({ where: { id: receipt.sourceWalletId }, select: { balance: true } }),
        prisma.wallet.findUniqueOrThrow({ where: { companyId: result.companyId }, select: { balance: true } }),
    ]);
    console.log(JSON.stringify({
        companyId: result.companyId,
        accountCode: buildCommercialAccountCode(result.companyId),
        changed: result.changed,
        sourceBalance: source.balance,
        newCompanyBalance: target.balance,
    }, null, 2));
    console.log(result.changed
        ? "APPLY OK: sede, compras y movimientos movidos. Falta provisionar la cuenta comercial en Diem."
        : "APPLY NO-OP: la sede ya pertenecía a la nueva empresa.");
}

async function main() {
    const { mode, values } = args();
    if (mode === "plan") await plan(values);
    else await apply(values);
}

main()
    .catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
