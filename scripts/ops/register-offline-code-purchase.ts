/**
 * Registers a code purchase whose PINs an operator handed to a company
 * outside the portal, at the time it really happened.
 *
 * The company never ordered, so there is no CodePurchase, no Diem order and
 * no wallet consumption. This rebuilds all three with the normal contract:
 *
 *   1. plan    — read-only. Prices the purchase with the company's cost rule,
 *                builds the exact frozen command the portal would send to
 *                Diem, and writes it (no PINs) plus a receipt.
 *   2. Diem    — `manage.py register_offline_partner_purchase` creates the
 *                order with those PINs and prints its code_request_id.
 *   3. apply   — checks that Diem delivered exactly that request, then writes
 *                the COMPLETED purchase and its consumption at the real time
 *                and rebuilds the running balances.
 *
 * PINs live only in the private pins file; nothing here prints them.
 *
 *   npm run purchase:offline -- plan --company <id> --denomination <id> --count 2 \
 *     --occurred-at 2026-10-16T15:10:00-05:00 --origin-phone <id> --actor-user <id> \
 *     --pins-file <pins.json> --out <dir>
 *   npm run purchase:offline -- apply --receipt <dir>/receipt.json --pins-file <pins.json> \
 *     --diem-request-id <uuid> --expected-database <name>
 */
import { createHash } from "node:crypto";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
    buildCodeRequestCommand,
    buildCommercialAccountCode,
    getCodeRequest,
    type CodeRequestCommand,
} from "@/lib/devdiem/fulfillment";
import { purchaseOriginSnapshot } from "@/lib/purchases/origin-snapshot";
import { walletPurchaseDescription } from "@/lib/wallet/presentation";
import { resolveCost } from "@/services/costing/costing.service";
import { assertLedgerConsistent, assertOpenPeriod, rebuildWalletLedger } from "@/services/wallet/ledger-write";

type Db = Prisma.TransactionClient | typeof prisma;

type Receipt = {
    version: 1;
    purchaseId: string;
    companyId: string;
    walletId: string;
    userId: string;
    productId: string;
    productName: string;
    denominationId: string;
    purchaseOriginPhoneId: string | null;
    originLabelSnapshot: string | null;
    count: number;
    occurredAt: string;
    unitAmount: number;
    totalAmount: number;
    currency: string;
    sourceAmount: number | null;
    sourceCurrency: string | null;
    appliedExchangeRate: number | null;
    pinHashes: string[];
    command: CodeRequestCommand;
    ledgerFingerprint: string;
};

const sha = (value: string) => createHash("sha256").update(value).digest("hex");

function args() {
    const [mode, ...rest] = process.argv.slice(2);
    if (mode !== "plan" && mode !== "apply") throw new Error("Uso: purchase:offline <plan|apply> ...");
    const values = new Map<string, string>();
    for (let i = 0; i < rest.length; i += 2) values.set(rest[i].replace(/^--/, ""), rest[i + 1]);
    const required = mode === "plan"
        ? ["company", "denomination", "count", "occurred-at", "actor-user", "pins-file", "out"]
        : ["receipt", "pins-file", "diem-request-id", "expected-database"];
    for (const key of required) if (!values.get(key)) throw new Error(`Falta --${key}`);
    return { mode, values } as const;
}

function privateJson(path: string, payload: unknown) {
    const target = resolve(path);
    mkdirSync(resolve(target, ".."), { recursive: true, mode: 0o700 });
    writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
    chmodSync(target, 0o600);
}

function readPins(path: string): string[] {
    const parsed = JSON.parse(readFileSync(resolve(path), "utf8")) as { pins?: unknown };
    if (!Array.isArray(parsed.pins) || !parsed.pins.every((pin) => typeof pin === "string" && pin.trim())) {
        throw new Error('El archivo de PIN debe ser {"pins": ["..."]}');
    }
    const pins = parsed.pins.map((pin: string) => pin.trim());
    if (new Set(pins).size !== pins.length) throw new Error("Hay PIN repetidos");
    return pins;
}

function parseOccurredAt(value: string): Date {
    if (!/[+-]\d{2}:\d{2}$|Z$/.test(value)) throw new Error("--occurred-at debe incluir zona horaria");
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new Error("--occurred-at inválida");
    if (date.getTime() > Date.now()) throw new Error("--occurred-at no puede estar en el futuro");
    return date;
}

/** Fingerprint of everything apply relies on: the ledger and any earlier delivery of these PINs. */
async function fingerprint(db: Db, walletId: string, purchaseId: string) {
    const [wallet, rows, existing] = await Promise.all([
        db.wallet.findUniqueOrThrow({ where: { id: walletId }, select: { balance: true } }),
        db.walletTransaction.findMany({
            where: { walletId },
            orderBy: [{ occurredAt: "asc" }, { occurredSequence: "asc" }, { id: "asc" }],
            select: { id: true, type: true, status: true, amount: true, occurredAt: true, occurredSequence: true },
        }),
        db.codePurchase.findUnique({ where: { id: purchaseId }, select: { id: true } }),
    ]);
    return sha(JSON.stringify({ balance: wallet.balance, rows, existing: Boolean(existing) }));
}

/** No purchase of the company may already hold one of these PINs. */
async function assertPinsUnsold(db: Db, companyId: string, pinHashes: string[]) {
    const purchases = await db.codePurchase.findMany({
        where: { companyId, deliveredCodes: { not: Prisma.DbNull } },
        select: { id: true, deliveredCodes: true },
    });
    const wanted = new Set(pinHashes);
    for (const purchase of purchases) {
        const codes = Array.isArray(purchase.deliveredCodes) ? purchase.deliveredCodes : [];
        if (codes.some((code) => typeof code === "string" && wanted.has(sha(code.trim())))) {
            throw new Error(`Un PIN ya figura entregado en la compra ${purchase.id}`);
        }
    }
}

async function plan(values: Map<string, string>) {
    const companyId = values.get("company")!;
    const denominationId = values.get("denomination")!;
    const count = Number(values.get("count"));
    const occurredAt = parseOccurredAt(values.get("occurred-at")!);
    const pins = readPins(values.get("pins-file")!);
    if (!Number.isInteger(count) || count < 1 || pins.length !== count) {
        throw new Error("--count debe coincidir con la cantidad de PIN");
    }
    const pinHashes = pins.map(sha).sort();

    const [company, wallet, denomination, actor, originPhone] = await Promise.all([
        prisma.company.findUnique({ where: { id: companyId }, select: { id: true, name: true } }),
        prisma.wallet.findUnique({ where: { companyId } }),
        prisma.productDenomination.findUnique({
            where: { id: denominationId },
            select: { id: true, devDiemProductId: true, product: { select: { id: true, name: true, devDiemProductId: true } } },
        }),
        prisma.user.findUnique({
            where: { id: values.get("actor-user")! },
            select: { id: true, role: true, email: true, name: true },
        }),
        values.get("origin-phone")
            ? prisma.purchaseOriginPhone.findFirst({
                where: { id: values.get("origin-phone")!, companyId, isActive: true },
                select: { id: true, phone: true, label: true },
            })
            : Promise.resolve(null),
    ]);
    if (!company) throw new Error("La compañía no existe");
    if (!wallet) throw new Error("La compañía no tiene wallet");
    if (!denomination) throw new Error("La denominación no existe");
    if (!actor?.email || !["SUPER_ADMIN", "SYSTEM_ADMIN"].includes(actor.role)) {
        throw new Error("--actor-user debe ser un administrador de plataforma con email");
    }
    if (values.get("origin-phone") && !originPhone) throw new Error("El número de origen no es de la compañía");
    const remoteProductId = denomination.devDiemProductId ?? denomination.product.devDiemProductId;
    if (!remoteProductId) throw new Error("La denominación no está mapeada a Diem");

    const priced = await prisma.$transaction(async (tx) => {
        await assertLedgerConsistent(tx, wallet.id, wallet.balance);
        await assertOpenPeriod(tx, wallet.id, occurredAt);
        await assertPinsUnsold(tx, companyId, pinHashes);
        // Inside a transaction the stored TRM is read and never fetched.
        return resolveCost(companyId, denomination.product.id, denomination.id, tx);
    });
    if (!priced || !(priced.amount > 0)) throw new Error("No existe un costo válido para este producto");

    const purchaseId = `offline-${sha(`${companyId}:${occurredAt.toISOString()}:${pinHashes.join(",")}`).slice(0, 20)}`;
    const originLabelSnapshot = originPhone ? (originPhone.label || originPhone.phone) : null;
    const totalAmount = Math.round(priced.amount * count * 100) / 100;
    // Same recipient the portal sends: the user who registers the purchase.
    const [firstName, ...lastName] = (actor.name || actor.email).trim().split(/\s+/);
    const command = buildCodeRequestCommand({
        idempotencyKey: `diem-sas-purchase:${companyId}:offline:${purchaseId}`,
        externalReference: `DIEM-SAS-PURCHASE-${purchaseId}`,
        correlationId: `code-purchase:${purchaseId}`,
        source: "partner_api",
        productId: remoteProductId,
        quantity: count,
        recipient: { firstName, lastName: lastName.join(" "), email: actor.email },
        commercial: {
            accountCode: buildCommercialAccountCode(companyId),
            referenceNamespace: "code_purchase",
            currencyCode: priced.currency,
            unitPrice: priced.amount,
            totalAmount,
        },
        metadata: {
            code_purchase_id: purchaseId,
            company_id: companyId,
            company_name: company.name,
            store_id: null,
            store_name: null,
            purchase_origin: purchaseOriginSnapshot({
                storeId: null,
                purchaseOriginPhoneId: originPhone?.id ?? null,
                originLabelSnapshot,
                purchaseOriginPhone: originPhone ? { phone: originPhone.phone } : null,
            }),
            commercial_occurred_at: occurredAt.toISOString(),
            commercial_sequence: 0,
            offline_delivery: true,
        },
    });

    const receipt: Receipt = {
        version: 1,
        purchaseId,
        companyId,
        walletId: wallet.id,
        userId: actor.id,
        productId: denomination.product.id,
        productName: denomination.product.name,
        denominationId: denomination.id,
        purchaseOriginPhoneId: originPhone?.id ?? null,
        originLabelSnapshot,
        count,
        occurredAt: occurredAt.toISOString(),
        unitAmount: priced.amount,
        totalAmount,
        currency: priced.currency,
        sourceAmount: priced.sourceAmount != null ? priced.sourceAmount * count : null,
        sourceCurrency: priced.sourceCurrency ?? null,
        appliedExchangeRate: priced.exchangeRate ?? null,
        pinHashes,
        command,
        ledgerFingerprint: await fingerprint(prisma, wallet.id, purchaseId),
    };
    const out = values.get("out")!;
    privateJson(join(out, "command.json"), command);
    privateJson(join(out, "receipt.json"), receipt);
    console.log(JSON.stringify({
        purchaseId,
        company: company.name,
        product: denomination.product.name,
        count,
        unitAmount: priced.amount,
        totalAmount,
        currency: priced.currency,
        costSource: priced.source,
        occurredAt: occurredAt.toISOString(),
        walletBalanceBefore: wallet.balance,
        externalReference: command.body.external_reference,
    }, null, 2));
    console.log("PLAN OK: sin cambios; ningún PIN fue impreso.");
}

async function apply(values: Map<string, string>) {
    const databases = await prisma.$queryRaw<Array<{ current_database: string }>>`SELECT current_database()`;
    if (databases[0]?.current_database !== values.get("expected-database")) {
        throw new Error("--expected-database no coincide con la base activa");
    }
    const receipt = JSON.parse(readFileSync(resolve(values.get("receipt")!), "utf8")) as Receipt;
    const pins = readPins(values.get("pins-file")!);
    if (JSON.stringify(pins.map(sha).sort()) !== JSON.stringify(receipt.pinHashes)) {
        throw new Error("Los PIN no coinciden con el plan");
    }

    // Diem must already hold the delivered order for exactly this command.
    const diemRequestId = values.get("diem-request-id")!;
    const request = await getCodeRequest(diemRequestId);
    if (request.external_reference !== receipt.command.body.external_reference) {
        throw new Error("La solicitud de Diem pertenece a otra compra");
    }
    if (request.status !== "delivered" || !request.commercial_order_id) {
        throw new Error(`La solicitud de Diem no está entregada (estado ${request.status})`);
    }

    const occurredAt = new Date(receipt.occurredAt);
    const created = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`offline-purchase:${receipt.purchaseId}`}))`;
        await tx.$queryRaw`SELECT "id" FROM "Wallet" WHERE "id" = ${receipt.walletId} FOR UPDATE`;
        const existing = await tx.codePurchase.findUnique({ where: { id: receipt.purchaseId } });
        if (existing) {
            if (existing.status !== "COMPLETED" || existing.diemRequestId !== diemRequestId) {
                throw new Error("Ya existe una compra con este id y otros datos");
            }
            return false;
        }
        if (await fingerprint(tx, receipt.walletId, receipt.purchaseId) !== receipt.ledgerFingerprint) {
            throw new Error("La wallet cambió después del plan; vuelve a correr plan");
        }
        const wallet = await tx.wallet.findUniqueOrThrow({ where: { id: receipt.walletId } });
        await assertLedgerConsistent(tx, wallet.id, wallet.balance);
        await assertOpenPeriod(tx, wallet.id, occurredAt);
        await assertPinsUnsold(tx, receipt.companyId, receipt.pinHashes);

        await tx.codePurchase.create({
            data: {
                id: receipt.purchaseId,
                companyId: receipt.companyId,
                storeId: null,
                userId: receipt.userId,
                productId: receipt.productId,
                denominationId: receipt.denominationId,
                count: receipt.count,
                totalAmount: receipt.totalAmount,
                currency: receipt.currency,
                status: "COMPLETED",
                fulfillmentStatus: "delivered",
                idempotencyKey: receipt.command.idempotencyKey,
                diemRequestId,
                diemRequestSnapshot: receipt.command as unknown as Prisma.InputJsonValue,
                deliveredCodes: pins,
                completedAt: occurredAt,
                createdAt: occurredAt,
                occurredAt,
                occurredSequence: 0,
                purchaseOriginPhoneId: receipt.purchaseOriginPhoneId,
                originLabelSnapshot: receipt.originLabelSnapshot,
                sourceAmount: receipt.sourceAmount,
                sourceCurrency: receipt.sourceCurrency,
                appliedExchangeRate: receipt.appliedExchangeRate,
                billingUnitAmount: receipt.unitAmount,
            },
        });
        // Same consumption settleCodePurchase writes, dated when the PINs were handed over.
        await tx.walletTransaction.create({
            data: {
                walletId: receipt.walletId,
                type: "CONSUMPTION",
                status: "CONFIRMED",
                amount: receipt.totalAmount,
                originalAmount: receipt.sourceAmount ?? receipt.totalAmount,
                originalCurrency: receipt.sourceCurrency ?? receipt.currency,
                exchangeRate: receipt.appliedExchangeRate ?? 1,
                description: walletPurchaseDescription(receipt.count, receipt.productName),
                createdById: receipt.userId,
                codePurchaseId: receipt.purchaseId,
                occurredAt,
                // The time comes from the operator's delivery record, not from this run.
                occurredAtSource: "SOURCE_SYSTEM",
            },
        });
        await rebuildWalletLedger(tx, receipt.walletId);
        return true;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 30_000 });

    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { id: receipt.walletId }, select: { balance: true } });
    console.log(JSON.stringify({ purchaseId: receipt.purchaseId, created, walletBalance: wallet.balance }));
    console.log(created
        ? "APPLY OK: compra y consumo registrados; ningún PIN fue impreso."
        : "APPLY NO-OP: la compra ya estaba registrada.");
}

async function main() {
    const { mode, values } = args();
    if (mode === "plan") await plan(values);
    else await apply(values);
}

main()
    .catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
