/** Idempotent correction of Virtual Zone's effective commercial ledger. */
import { createHash } from "node:crypto";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { Prisma, PrismaClient } from "@prisma/client";
import { rebuildBalances } from "../src/lib/wallet/ledger";

const prisma = new PrismaClient();
const COMPANY_ID = "cms92txq90000amogy81su0zd";
const WALLET_ID = "cms9j3dlt000411e1hs770uis";
const ACTOR_ID = "cmixxhiad00092fwzu5gsb6gy";
const PAYMENT_ID = "cmuq2f5or0002l8tsr847mrfp";
const OPENING_ID = "virtual-zone-opening-20260929";
const LOCK_NAME = "virtual-zone-ledger-2026-10-v1";
const EXPECTED_BALANCE = -1_640_450;
const EDWIN_EMAIL = "edwin@virtualzoneadventure.com";

type Event = {
    purchaseId: string;
    orderId: number;
    occurredAt: string;
    buyer: "Edwin" | "Juan Pablo" | "Virtual Zone";
    phone: string | null;
    denomination: number;
    count: number;
    fxRate: number;
    amountCop: number;
    codes?: string[];
    codeHashes?: string[];
};
type Manifest = { version: 1; companyId: string; events: Event[] };

const sha = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");
const canonical = (value: unknown): string => value instanceof Date
    ? JSON.stringify(value.toISOString())
    : Array.isArray(value)
        ? `[${value.map(canonical).join(",")}]`
        : value && typeof value === "object"
        ? `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`
        : JSON.stringify(value);

function args() {
    const [mode, ...rest] = process.argv.slice(2);
    if (mode !== "plan" && mode !== "apply") throw new Error("Uso: repair:virtual-zone <plan|apply> ...");
    const values = new Map<string, string>();
    for (let i = 0; i < rest.length; i += 2) values.set(rest[i].replace(/^--/, ""), rest[i + 1]);
    for (const key of ["input", "manifest-sha256", "receipt"]) if (!values.get(key)) throw new Error(`Falta --${key}`);
    if (mode === "apply" && (!values.get("backup") || !values.get("report") || !values.get("expected-database"))) {
        throw new Error("apply exige --backup, --report y --expected-database");
    }
    return { mode, values } as const;
}

function loadManifest(path: string, expectedHash: string): Manifest {
    const raw = readFileSync(resolve(path));
    if (sha(raw) !== expectedHash.toLowerCase()) throw new Error("El hash del manifiesto no coincide.");
    const manifest = JSON.parse(raw.toString("utf8")) as Manifest;
    const codeHashes = manifest.events.flatMap((row) => [
        ...(row.codes ?? []).map((code) => sha(code)),
        ...(row.codeHashes ?? []),
    ]);
    if (manifest.version !== 1 || manifest.companyId !== COMPANY_ID || manifest.events.length !== 12 || codeHashes.length !== 15 || new Set(codeHashes).size !== 15) {
        throw new Error("El manifiesto no contiene las 12 compras y 15 PIN únicos esperados.");
    }
    if (manifest.events.reduce((sum, row) => sum + row.amountCop, 0) !== 1_361_250) throw new Error("Total de compras inválido.");
    for (const row of manifest.events) {
        if (row.amountCop !== row.count * row.denomination * row.fxRate) throw new Error(`Importe inválido: ${row.purchaseId}`);
        if (!/^2026-/.test(row.occurredAt) || !row.occurredAt.endsWith("-05:00")) throw new Error(`Zona horaria inválida: ${row.purchaseId}`);
    }
    return manifest;
}

function privateJson(path: string, payload: unknown) {
    const target = resolve(path);
    mkdirSync(resolve(target, ".."), { recursive: true, mode: 0o700 });
    writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
    chmodSync(target, 0o600);
}

async function snapshot(manifest: Manifest, db: Prisma.TransactionClient | PrismaClient = prisma) {
    const ids = manifest.events.map((row) => row.purchaseId);
    const [wallet, purchases, transactions, statements, originPhones, edwin] = await Promise.all([
        db.wallet.findUnique({ where: { id: WALLET_ID } }),
        db.codePurchase.findMany({ where: { id: { in: ids } }, orderBy: { id: "asc" } }),
        db.walletTransaction.findMany({ where: { walletId: WALLET_ID }, orderBy: [{ occurredAt: "asc" }, { occurredSequence: "asc" }, { id: "asc" }] }),
        db.accountStatement.count({ where: { companyId: COMPANY_ID } }),
        db.purchaseOriginPhone.findMany({
            where: { companyId: COMPANY_ID, phone: { in: ["3003702892", "3147199788"] } },
            orderBy: { phone: "asc" },
        }),
        db.user.findUnique({
            where: { email: EDWIN_EMAIL },
            select: { id: true, companyId: true, purchaseOriginPhoneId: true },
        }),
    ]);
    const safe = {
        wallet,
        statements,
        purchases: purchases.map((row) => ({ ...row, deliveredCodes: Array.isArray(row.deliveredCodes) ? row.deliveredCodes.map((v) => sha(String(v))) : row.deliveredCodes })),
        transactions,
        originPhones,
        edwin: edwin ? { id: edwin.id, companyId: edwin.companyId, purchaseOriginPhoneId: edwin.purchaseOriginPhoneId } : null,
    };
    return { wallet, purchases, transactions, statements, originPhones, edwin, fingerprint: sha(canonical(safe)) };
}

function validate(manifest: Manifest, snap: Awaited<ReturnType<typeof snapshot>>) {
    if (!snap.wallet || snap.wallet.companyId !== COMPANY_ID || snap.purchases.length !== 12) throw new Error("Wallet o compras esperadas ausentes.");
    if (snap.statements) throw new Error("Virtual Zone ya tiene estados de cuenta emitidos.");
    if (!snap.edwin || snap.edwin.companyId !== COMPANY_ID) throw new Error("No se encontró el perfil único de Edwin en Virtual Zone.");
    for (const event of manifest.events) {
        const purchase = snap.purchases.find((row) => row.id === event.purchaseId)!;
        const actualHashes = Array.isArray(purchase.deliveredCodes)
            ? purchase.deliveredCodes.filter((v): v is string => typeof v === "string").map((code) => sha(code)).sort()
            : [];
        const expectedHashes = [
            ...(event.codes ?? []).map((code) => sha(code)),
            ...(event.codeHashes ?? []),
        ].sort();
        if (purchase.status !== "COMPLETED" || canonical(actualHashes) !== canonical(expectedHashes)) throw new Error(`PIN o estado incompatible: ${event.purchaseId}`);
        const txs = snap.transactions.filter((row) => row.codePurchaseId === event.purchaseId && row.type === "CONSUMPTION");
        if (txs.length !== 1) throw new Error(`Movimiento no único: ${event.purchaseId}`);
    }
    const payment = snap.transactions.find((row) => row.id === PAYMENT_ID);
    if (!payment || payment.type !== "RECHARGE" || payment.amount !== 1_400_000) throw new Error("No se encontró el pago de $1.400.000.");
}

function isApplied(manifest: Manifest, snap: Awaited<ReturnType<typeof snapshot>>) {
    const phoneByLabel = new Map(snap.originPhones.map((row) => [row.label, row]));
    const edwinPhone = phoneByLabel.get("Edwin");
    if (
        snap.wallet?.balance !== EXPECTED_BALANCE
        || !edwinPhone
        || edwinPhone.phone !== "3003702892"
        || !edwinPhone.isActive
        || phoneByLabel.get("Juan Pablo")?.phone !== "3147199788"
        || snap.edwin?.purchaseOriginPhoneId !== edwinPhone.id
    ) return false;

    const openings = snap.transactions.filter((row) => row.type === "OPENING_BALANCE");
    const opening = openings.find((row) => row.id === OPENING_ID);
    const payment = snap.transactions.find((row) => row.id === PAYMENT_ID);
    if (
        openings.length !== 1
        || !opening
        || opening.amount !== 1_679_200
        || opening.occurredAt.getTime() !== new Date("2026-09-29T13:39:00-05:00").getTime()
        || !payment
        || payment.occurredAt.getTime() !== new Date("2026-09-30T16:29:00-05:00").getTime()
    ) return false;

    for (const [eventIndex, event] of manifest.events.entries()) {
        const purchase = snap.purchases.find((row) => row.id === event.purchaseId);
        const phone = event.phone ? phoneByLabel.get(event.buyer) : null;
        const movement = snap.transactions.find((row) =>
            row.codePurchaseId === event.purchaseId && row.type === "CONSUMPTION"
        );
        if (
            !purchase || (event.phone && !phone) || !movement
            || purchase.count !== event.count
            || purchase.totalAmount !== event.amountCop
            || purchase.currency !== "COP"
            || purchase.occurredAt.getTime() !== new Date(event.occurredAt).getTime()
            || purchase.occurredSequence !== eventIndex + 1
            || purchase.storeId !== null
            || purchase.purchaseOriginPhoneId !== (phone?.id ?? null)
            || purchase.originLabelSnapshot !== event.buyer
            || movement.amount !== event.amountCop
            || movement.originalAmount !== event.count * event.denomination
            || movement.originalCurrency !== "USD"
            || movement.exchangeRate !== event.fxRate
            || movement.status !== "CONFIRMED"
            || movement.occurredAt.getTime() !== new Date(event.occurredAt).getTime()
            || movement.occurredSequence !== eventIndex + 1
        ) return false;
    }
    const rebuilt = rebuildBalances(snap.transactions.map((row) => ({
        ...row,
        type: row.type as any,
        status: row.status as any,
    })));
    return rebuilt.balance === EXPECTED_BALANCE
        && [...rebuilt.balances].every(([id, balance]) =>
            snap.transactions.find((row) => row.id === id)?.balanceAfter === balance
        );
}

async function apply(manifest: Manifest, fingerprint: string) {
    return prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${LOCK_NAME}))`;
        await tx.$queryRaw`SELECT "id" FROM "Wallet" WHERE "id" = ${WALLET_ID} FOR UPDATE`;
        const current = await snapshot(manifest, tx);
        validate(manifest, current);
        if (current.fingerprint !== fingerprint) throw new Error("La base cambió después del plan.");
        if (isApplied(manifest, current)) return false;

        const phones = new Map<string, string>();
        for (const [label, phone] of [["Edwin", "3003702892"], ["Juan Pablo", "3147199788"]] as const) {
            const row = await tx.purchaseOriginPhone.upsert({
                where: { companyId_phone: { companyId: COMPANY_ID, phone } },
                create: { companyId: COMPANY_ID, phone, label },
                update: { label, isActive: true },
            });
            phones.set(label, row.id);
        }
        await tx.user.update({
            where: { email: EDWIN_EMAIL },
            data: { purchaseOriginPhoneId: phones.get("Edwin") },
        });
        await tx.walletTransaction.upsert({
            where: { id: OPENING_ID },
            create: {
                id: OPENING_ID, walletId: WALLET_ID, type: "OPENING_BALANCE", status: "CONFIRMED",
                amount: 1_679_200, balanceAfter: -1_679_200, description: "Saldo anterior - Virtual Zone",
                createdById: ACTOR_ID, occurredAt: new Date("2026-09-29T13:39:00-05:00"),
            },
            update: { amount: 1_679_200, balanceAfter: -1_679_200, occurredAt: new Date("2026-09-29T13:39:00-05:00") },
        });
        await tx.walletTransaction.update({
            where: { id: PAYMENT_ID },
            data: { occurredAt: new Date("2026-09-30T16:29:00-05:00"), description: "Pago - Virtual Zone", balanceAfter: null },
        });
        for (const [eventIndex, event] of manifest.events.entries()) {
            const purchase = await tx.codePurchase.update({
                where: { id: event.purchaseId },
                data: {
                    count: event.count,
                    totalAmount: event.amountCop,
                    currency: "COP",
                    occurredAt: new Date(event.occurredAt),
                    occurredSequence: eventIndex + 1,
                    purchaseOriginPhoneId: event.phone ? phones.get(event.buyer) : null,
                    originLabelSnapshot: event.buyer,
                },
            });
            await tx.walletTransaction.updateMany({
                where: { walletId: WALLET_ID, codePurchaseId: purchase.id, type: "CONSUMPTION" },
                data: {
                    status: "CONFIRMED",
                    amount: event.amountCop,
                    originalAmount: event.count * event.denomination,
                    originalCurrency: "USD",
                    exchangeRate: event.fxRate,
                    occurredAt: new Date(event.occurredAt),
                    occurredSequence: eventIndex + 1,
                    description: `Buy - ${event.buyer}`,
                    balanceAfter: null,
                },
            });
        }
        const ledger = await tx.walletTransaction.findMany({ where: { walletId: WALLET_ID } });
        const rebuilt = rebuildBalances(ledger.map((row) => ({ ...row, type: row.type as any, status: row.status as any })));
        for (const [id, balanceAfter] of rebuilt.balances) await tx.walletTransaction.update({ where: { id }, data: { balanceAfter } });
        if (rebuilt.balance !== EXPECTED_BALANCE) throw new Error(`Saldo final inesperado: ${rebuilt.balance}`);
        await tx.wallet.update({ where: { id: WALLET_ID }, data: { balance: rebuilt.balance } });
        return true;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 30_000 });
}

async function main() {
    const { mode, values } = args();
    const manifest = loadManifest(values.get("input")!, values.get("manifest-sha256")!);
    if (mode === "apply") {
        const databases = await prisma.$queryRaw<Array<{ current_database: string }>>`SELECT current_database()`;
        if (databases[0]?.current_database !== values.get("expected-database")) {
            throw new Error("--expected-database no coincide con la base activa.");
        }
    }
    const before = await snapshot(manifest);
    validate(manifest, before);
    const receipt = { version: 1, fingerprint: before.fingerprint, purchases: before.purchases.length, transactions: before.transactions.length, walletBalance: before.wallet!.balance };
    if (mode === "plan") {
        privateJson(values.get("receipt")!, receipt);
        console.log(JSON.stringify(receipt));
        console.log("PLAN OK: ningún PIN fue impreso y no se hicieron cambios.");
        return;
    }
    const planned = JSON.parse(readFileSync(resolve(values.get("receipt")!), "utf8"));
    if (canonical(planned) !== canonical(receipt)) throw new Error("El recibo ya no corresponde al estado actual.");
    privateJson(values.get("backup")!, { capturedAt: new Date().toISOString(), ...before });
    const changed = await apply(manifest, before.fingerprint);
    const after = await snapshot(manifest);
    const report = { changed, balance: after.wallet!.balance, purchases: after.purchases.length, openingBalances: after.transactions.filter((row) => row.type === "OPENING_BALANCE").length };
    if (report.balance !== EXPECTED_BALANCE || report.openingBalances !== 1) throw new Error("Postcondición fallida.");
    privateJson(values.get("report")!, report);
    console.log(JSON.stringify(report));
    console.log(changed
        ? "APPLY OK: balance reconstruido; ningún PIN fue impreso."
        : "APPLY NO-OP: el estado comercial ya era el esperado; ningún PIN fue impreso.");
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
