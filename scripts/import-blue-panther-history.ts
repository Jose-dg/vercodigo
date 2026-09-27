/**
 * Idempotent reconstruction of Blue Panther's commercial history.
 *
 * The source manifest and backups contain secrets and must remain outside git.
 * This script never prints delivered codes and never calls fulfillment.
 */
import { createHash } from "node:crypto";
import { closeSync, openSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { resolve } from "node:path";

function loadLocalEnv() {
    try {
        for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("#")) continue;
            const separator = trimmed.indexOf("=");
            if (separator < 1) continue;
            const key = trimmed.slice(0, separator);
            let value = trimmed.slice(separator + 1);
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            if (!process.env[key]) process.env[key] = value;
        }
    } catch {
        // DATABASE_URL may already be present in the process environment.
    }
}
loadLocalEnv();

import {
    ActivationBillingStatus,
    KeyStatus,
    Prisma,
    PrismaClient,
    WalletRechargeMethod,
    WalletTransactionStatus,
    WalletTransactionType,
} from "@prisma/client";

const prisma = new PrismaClient();

const MANIFEST_SHA256 = "f60846a1c5b71ae27a26fced7e666003b7ca4dbdc8c8133c09f03dda10dfd1d6";
const LOCK_NAME = "blue-panther-history-v1:diem-sas";
const COMPANY_ID = "cmtxjz5610000twq7gga3gox0";
const STORE_ID = "cmll2adjv00012kz8jb43ix26";
const ACTOR_ID = "cmixxhiad00092fwzu5gsb6gy";
const WALLET_ID = "cmtxk98uc000512wecghl0d94";
const INITIAL_COMPANY_ID = "cmj4i0pto00007srdyecdmxkk";
const EXPECTED_CONSUMPTION = 2_569_400;
const EXPECTED_RECHARGE = 1_645_400;
const EXPECTED_BALANCE = -924_000;

const PRODUCT_IDS: Record<string, string> = {
    "US:1": "046e0ec2-2753-47de-a285-88ce78023c8f",
    "US:2": "e2a59b89-13da-4200-9829-ae7d32409666",
    "US:5": "4dca9f32-f9f0-4711-a877-9a56dc476708",
    "US:10": "13e29806-9fc5-4b32-877a-8508e1214433",
    "US:50": "392656c6-4324-459a-bd03-8f8a9a2c8b7a",
    "CO:10": "aa4c666f-19ba-480f-abca-986cf56e23f0",
};

const EXISTING_CANONICAL: Record<string, string> = {
    "20260911-180300-us10": "cmtxk95dx000212wemp15czqe",
    "20260915-201300-us10": "cmu3dqli500027e0m3utrjseh",
    "20260918-205100-us10": "cmu7qbupj0002ix8e875p78ne",
    "20260922-161300-co10": "cmud67vur0002qgygus975dkn",
};
const ABSORBED_PURCHASE_ID = "cmu7qde2w0002z004pirjd5rf";
const DUPLICATE_REQUEST_ID = "cmtxjzoo60003twq7i2a748cw";
const CARD_UUIDS = ["MVDC5JSB", "PFGZ8YE2"] as const;

type PurchaseEvent = {
    key: string;
    kind: "code_purchase";
    occurredAt: string;
    region: "US" | "CO";
    denomination: number;
    fxRate: number;
    billedCount: number;
    amountCop: number;
    codes: string[];
};
type RechargeEvent = {
    key: string;
    kind: "recharge";
    occurredAt: string;
    amountCop: number;
    externalReference?: string;
};
type ActivationEvent = {
    key: string;
    kind: "card_activation";
    occurredAt: string;
    denomination: number;
    fxRate: number;
    billedCount: number;
    amountCop: number;
    cardUuids: string[];
};
type HistoryEvent = PurchaseEvent | RechargeEvent | ActivationEvent;
type Manifest = { version: number; companyId: string; storeId: string; actorId: string; events: HistoryEvent[] };

function sha(value: string | Buffer): string {
    return createHash("sha256").update(value).digest("hex");
}

function canonical(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
    if (value && typeof value === "object") {
        return `{${Object.entries(value as Record<string, unknown>)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, nested]) => `${JSON.stringify(key)}:${canonical(nested)}`)
            .join(",")}}`;
    }
    return JSON.stringify(value);
}

function writePrivateJson(path: string, payload: unknown, exclusive: boolean) {
    const absolute = resolve(path);
    const fd = openSync(absolute, exclusive ? "wx" : "w", 0o600);
    try {
        writeFileSync(fd, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    } finally {
        closeSync(fd);
    }
    chmodSync(absolute, 0o600);
}

function parseArgs() {
    const [mode, ...rest] = process.argv.slice(2);
    if (mode !== "plan" && mode !== "apply") throw new Error("Uso: import-blue-panther-history <plan|apply> ...");
    const values = new Map<string, string>();
    for (let index = 0; index < rest.length; index += 2) {
        const key = rest[index];
        const value = rest[index + 1];
        if (!key?.startsWith("--") || !value) throw new Error(`Argumento inválido: ${key ?? "vacío"}`);
        values.set(key.slice(2), value);
    }
    for (const required of ["input", "receipt"]) {
        if (!values.has(required)) throw new Error(`Falta --${required}`);
    }
    if (mode === "apply" && (!values.has("backup") || !values.has("report"))) {
        throw new Error("apply exige --backup y --report");
    }
    return { mode, values } as const;
}

function loadManifest(path: string): Manifest {
    const raw = readFileSync(resolve(path));
    const digest = sha(raw);
    if (digest !== MANIFEST_SHA256) throw new Error(`El manifiesto no es la versión aprobada (sha256=${digest}).`);
    const manifest = JSON.parse(raw.toString("utf8")) as Manifest;
    if (manifest.companyId !== COMPANY_ID || manifest.storeId !== STORE_ID || manifest.actorId !== ACTOR_ID) {
        throw new Error("Identidades del manifiesto incompatibles con Blue Panther v1.");
    }
    const purchases = manifest.events.filter((event): event is PurchaseEvent => event.kind === "code_purchase");
    const recharges = manifest.events.filter((event): event is RechargeEvent => event.kind === "recharge");
    const activations = manifest.events.filter((event): event is ActivationEvent => event.kind === "card_activation");
    const codes = purchases.flatMap((event) => event.codes);
    if (purchases.length !== 29 || recharges.length !== 6 || activations.length !== 1 || codes.length !== 124) {
        throw new Error("El manifiesto debe contener 29 compras, 6 abonos, 1 evento QR y 124 PIN.");
    }
    if (new Set(codes).size !== codes.length) throw new Error("El manifiesto contiene PIN duplicados.");
    for (const event of purchases) {
        if (!PRODUCT_IDS[`${event.region}:${event.denomination}`]) throw new Error(`Producto no permitido: ${event.key}`);
        if (event.amountCop !== event.billedCount * event.denomination * event.fxRate) {
            throw new Error(`Cálculo COP inconsistente: ${event.key}`);
        }
    }
    const consumption = purchases.reduce((sum, event) => sum + event.amountCop, 0)
        + activations.reduce((sum, event) => sum + event.amountCop, 0);
    const recharge = recharges.reduce((sum, event) => sum + event.amountCop, 0);
    if (consumption !== EXPECTED_CONSUMPTION || recharge !== EXPECTED_RECHARGE || recharge - consumption !== EXPECTED_BALANCE) {
        throw new Error("Los totales del manifiesto no coinciden con el histórico aprobado.");
    }
    return manifest;
}

async function loadSnapshot(client: PrismaClient | Prisma.TransactionClient) {
    const [company, actor, store, wallet, cards, purchases, transactions, denominations] = await Promise.all([
        client.company.findUnique({ where: { id: COMPANY_ID }, select: { id: true, name: true, taxId: true } }),
        client.user.findUnique({ where: { id: ACTOR_ID }, select: { id: true, email: true, role: true, isActive: true } }),
        client.store.findUnique({
            where: { id: STORE_ID },
            include: {
                _count: { select: { users: true, authorizedPhones: true, InvoiceItem: true, activations: true } },
            },
        }),
        client.wallet.findUnique({ where: { id: WALLET_ID } }),
        client.card.findMany({
            where: { storeId: STORE_ID },
            include: { key: true, activation: true, activationJobs: true },
            orderBy: { id: "asc" },
        }),
        client.codePurchase.findMany({ where: { companyId: COMPANY_ID }, orderBy: { id: "asc" } }),
        client.walletTransaction.findMany({ where: { walletId: WALLET_ID }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
        client.productDenomination.findMany({
            where: { devDiemProductId: { in: Object.values(PRODUCT_IDS) } },
            include: { product: { select: { id: true, name: true } } },
            orderBy: { devDiemProductId: "asc" },
        }),
    ]);
    const safe = {
        company,
        actor,
        store: store && { id: store.id, companyId: store.companyId, code: store.code, counts: store._count },
        wallet,
        cards: cards.map((card) => ({
            id: card.id,
            uuid: card.uuid,
            isActivated: card.isActivated,
            activatedAt: card.activatedAt,
            keyId: card.keyId,
            keyStatus: card.key?.status,
            keyHash: card.key ? sha(card.key.code) : null,
            activation: card.activation,
            jobCount: card.activationJobs.length,
        })),
        purchases: purchases.map((purchase) => ({
            ...purchase,
            deliveredCodes: Array.isArray(purchase.deliveredCodes)
                ? purchase.deliveredCodes.map((code) => typeof code === "string" ? sha(code) : "invalid")
                : purchase.deliveredCodes,
        })),
        transactions,
        denominations: denominations.map((row) => ({
            id: row.id,
            amount: row.amount,
            currency: row.currency,
            devDiemProductId: row.devDiemProductId,
            productId: row.productId,
            productName: row.product.name,
        })),
    };
    return { company, actor, store, wallet, cards, purchases, transactions, denominations, fingerprint: sha(canonical(safe)) };
}

function validateSnapshot(snapshot: Awaited<ReturnType<typeof loadSnapshot>>, manifest: Manifest) {
    if (!snapshot.company || !snapshot.actor || !snapshot.actor.isActive || !snapshot.store || !snapshot.wallet) {
        throw new Error("Falta empresa, actor, tienda o wallet de Blue Panther.");
    }
    if (![INITIAL_COMPANY_ID, COMPANY_ID].includes(snapshot.store.companyId)) throw new Error("La tienda pertenece a una empresa inesperada.");
    if (snapshot.store._count.users || snapshot.store._count.authorizedPhones || snapshot.store._count.InvoiceItem) {
        throw new Error("La tienda tiene usuarios, teléfonos o facturas que impiden moverla con seguridad.");
    }
    if (snapshot.cards.length !== 20) throw new Error(`Se esperaban 20 tarjetas; hay ${snapshot.cards.length}.`);
    const selected = snapshot.cards.filter((card) => CARD_UUIDS.includes(card.uuid as typeof CARD_UUIDS[number]));
    if (selected.length !== 2 || selected.some((card) => !card.keyId || card.activationJobs.length)) {
        throw new Error("Las dos tarjetas históricas no cumplen las precondiciones.");
    }
    const otherActivated = snapshot.cards.filter((card) => !CARD_UUIDS.includes(card.uuid as typeof CARD_UUIDS[number]) && card.isActivated);
    if (otherActivated.length) throw new Error("Hay tarjetas adicionales activadas fuera del histórico aprobado.");
    if (snapshot.denominations.length !== Object.keys(PRODUCT_IDS).length) throw new Error("Faltan denominaciones históricas en el catálogo público.");

    const expectedCodes = new Set(manifest.events.filter((event): event is PurchaseEvent => event.kind === "code_purchase").flatMap((event) => event.codes));
    const owners = new Map<string, string>();
    for (const purchase of snapshot.purchases) {
        if (!Array.isArray(purchase.deliveredCodes)) continue;
        for (const code of purchase.deliveredCodes) {
            if (typeof code !== "string" || !expectedCodes.has(code)) continue;
            const prior = owners.get(code);
            if (prior && prior !== purchase.id) {
                const allowedMerge = new Set([EXISTING_CANONICAL["20260918-205100-us10"], ABSORBED_PURCHASE_ID]);
                if (!allowedMerge.has(prior) || !allowedMerge.has(purchase.id)) throw new Error("Un PIN ya figura en más de una compra incompatible.");
            }
            owners.set(code, purchase.id);
        }
    }
    const requiredExistingIds = [
        ...Object.values(EXISTING_CANONICAL),
        ABSORBED_PURCHASE_ID,
        DUPLICATE_REQUEST_ID,
    ];
    if (requiredExistingIds.some((id) => !snapshot.purchases.some((purchase) => purchase.id === id))) {
        throw new Error("Falta una compra preexistente requerida para la reconciliación.");
    }
    for (const event of manifest.events.filter((row): row is PurchaseEvent => row.kind === "code_purchase")) {
        const expectedOwner = purchaseId(event);
        for (const code of event.codes) {
            const owner = owners.get(code);
            const allowedOwners = event.key === "20260918-205100-us10"
                ? new Set([expectedOwner, ABSORBED_PURCHASE_ID])
                : new Set([expectedOwner]);
            if (owner && !allowedOwners.has(owner)) {
                throw new Error(`Un PIN histórico pertenece a una compra incompatible (evento ${event.key}).`);
            }
        }
    }
    const adjustments = snapshot.transactions.filter((row) => row.type === WalletTransactionType.ADJUSTMENT);
    if (adjustments.length) throw new Error("La wallet contiene movimientos ADJUSTMENT; no se reconstruirá sobre ellos.");
}

function purchaseId(event: PurchaseEvent) {
    return EXISTING_CANONICAL[event.key] ?? `bp-hist-purchase-${event.key}`;
}

function denominationMap(snapshot: Awaited<ReturnType<typeof loadSnapshot>>) {
    return new Map(snapshot.denominations.map((row) => [row.devDiemProductId!, row]));
}

function isFinalState(snapshot: Awaited<ReturnType<typeof loadSnapshot>>, manifest: Manifest): boolean {
    if (snapshot.store?.companyId !== COMPANY_ID || snapshot.wallet?.balance !== EXPECTED_BALANCE) return false;
    const selectedCards = snapshot.cards.filter((card) => CARD_UUIDS.includes(card.uuid as typeof CARD_UUIDS[number]));
    if (selectedCards.length !== 2
        || selectedCards.some((card) => !card.isActivated || card.key?.status !== KeyStatus.SOLD || card.activation?.billingStatus !== ActivationBillingStatus.PAID)
        || snapshot.cards.filter((card) => !CARD_UUIDS.includes(card.uuid as typeof CARD_UUIDS[number])).some((card) => card.isActivated)) {
        return false;
    }
    const denoms = denominationMap(snapshot);
    const purchaseEvents = manifest.events.filter((event): event is PurchaseEvent => event.kind === "code_purchase");
    for (const event of purchaseEvents) {
        const purchase = snapshot.purchases.find((row) => row.id === purchaseId(event));
        const denomination = denoms.get(PRODUCT_IDS[`${event.region}:${event.denomination}`]);
        const codes = Array.isArray(purchase?.deliveredCodes) ? purchase.deliveredCodes : [];
        if (!purchase || !denomination
            || purchase.status !== "COMPLETED"
            || purchase.companyId !== COMPANY_ID
            || purchase.storeId !== STORE_ID
            || purchase.productId !== denomination.productId
            || purchase.denominationId !== denomination.id
            || purchase.count !== event.billedCount
            || purchase.totalAmount !== event.amountCop
            || canonical(codes) !== canonical(event.codes)) {
            return false;
        }
    }
    const absorbed = snapshot.purchases.find((row) => row.id === ABSORBED_PURCHASE_ID);
    const duplicate = snapshot.purchases.find((row) => row.id === DUPLICATE_REQUEST_ID);
    if (absorbed?.status !== "FAILED" || duplicate?.status !== "FAILED") return false;

    const confirmed = snapshot.transactions.filter((row) => row.status === WalletTransactionStatus.CONFIRMED);
    const consumption = confirmed.filter((row) => row.type === WalletTransactionType.CONSUMPTION);
    const recharges = confirmed.filter((row) => row.type === WalletTransactionType.RECHARGE);
    if (confirmed.length !== 37 || consumption.length !== 31 || recharges.length !== 6
        || consumption.reduce((sum, row) => sum + row.amount, 0) !== EXPECTED_CONSUMPTION
        || recharges.reduce((sum, row) => sum + row.amount, 0) !== EXPECTED_RECHARGE
        || snapshot.transactions.some((row) => row.type === WalletTransactionType.ADJUSTMENT)) {
        return false;
    }
    let balance = 0;
    for (const row of confirmed.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id))) {
        balance += row.type === WalletTransactionType.RECHARGE || row.type === WalletTransactionType.REFUND
            ? row.amount
            : -row.amount;
        balance = Math.round(balance * 100) / 100;
        if (row.balanceAfter !== balance) return false;
    }
    return balance === EXPECTED_BALANCE;
}

async function applyHistory(manifest: Manifest, expectedFingerprint: string) {
    await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${LOCK_NAME}))`;
        await tx.$queryRaw`SELECT id FROM "Wallet" WHERE id = ${WALLET_ID} FOR UPDATE`;
        const current = await loadSnapshot(tx);
        validateSnapshot(current, manifest);
        if (current.fingerprint !== expectedFingerprint) throw new Error("La base cambió después del plan; operación abortada.");

        const denoms = denominationMap(current);
        await tx.store.update({ where: { id: STORE_ID }, data: { companyId: COMPANY_ID } });

        const activationEvent = manifest.events.find((event): event is ActivationEvent => event.kind === "card_activation")!;
        const activationAt = new Date(activationEvent.occurredAt);
        for (let index = 0; index < CARD_UUIDS.length; index += 1) {
            const uuid = CARD_UUIDS[index];
            const card = current.cards.find((row) => row.uuid === uuid)!;
            await tx.card.update({ where: { id: card.id }, data: { isActivated: true, activatedAt: activationAt } });
            await tx.key.update({ where: { id: card.keyId! }, data: { status: KeyStatus.SOLD } });
            const activationId = `bp-hist-activation-${uuid.toLowerCase()}`;
            await tx.cardActivation.upsert({
                where: { cardId: card.id },
                create: {
                    id: activationId,
                    cardId: card.id,
                    storeId: STORE_ID,
                    activatedBy: ACTOR_ID,
                    activatedAt: activationAt,
                    activationAmount: activationEvent.denomination,
                    billingStatus: ActivationBillingStatus.PAID,
                    matrixResponse: { source: "blue-panther-history-v1", imported: true },
                },
                update: {
                    storeId: STORE_ID,
                    activatedBy: ACTOR_ID,
                    activatedAt: activationAt,
                    activationAmount: activationEvent.denomination,
                    billingStatus: ActivationBillingStatus.PAID,
                    matrixResponse: { source: "blue-panther-history-v1", imported: true },
                },
            });
            await tx.walletTransaction.upsert({
                where: { cardActivationId: activationId },
                create: {
                    id: `bp-hist-wallet-activation-${uuid.toLowerCase()}`,
                    walletId: WALLET_ID,
                    type: WalletTransactionType.CONSUMPTION,
                    status: WalletTransactionStatus.CONFIRMED,
                    amount: activationEvent.amountCop / activationEvent.billedCount,
                    originalAmount: activationEvent.denomination,
                    originalCurrency: "USD",
                    exchangeRate: activationEvent.fxRate,
                    description: "Activación QR histórica Blue Panther",
                    createdById: ACTOR_ID,
                    cardActivationId: activationId,
                    createdAt: new Date(activationAt.getTime() + index),
                },
                update: {
                    status: WalletTransactionStatus.CONFIRMED,
                    amount: activationEvent.amountCop / activationEvent.billedCount,
                    balanceAfter: null,
                    originalAmount: activationEvent.denomination,
                    originalCurrency: "USD",
                    exchangeRate: activationEvent.fxRate,
                    description: "Activación QR histórica Blue Panther",
                    createdById: ACTOR_ID,
                },
            });
        }

        const purchaseEvents = manifest.events.filter((event): event is PurchaseEvent => event.kind === "code_purchase");
        for (const event of purchaseEvents) {
            const devDiemProductId = PRODUCT_IDS[`${event.region}:${event.denomination}`];
            const denomination = denoms.get(devDiemProductId);
            if (!denomination) throw new Error(`Denominación ausente durante apply: ${event.key}`);
            const id = purchaseId(event);
            const existing = current.purchases.find((row) => row.id === id);
            const common = {
                companyId: COMPANY_ID,
                storeId: STORE_ID,
                userId: ACTOR_ID,
                productId: denomination.productId,
                denominationId: denomination.id,
                count: event.billedCount,
                totalAmount: event.amountCop,
                currency: "COP",
                status: "COMPLETED",
                fulfillmentStatus: "delivered",
                deliveredCodes: event.codes,
                lastError: null,
                attempts: 0,
                nextRetryAt: null,
            } satisfies Prisma.CodePurchaseUncheckedUpdateInput;
            if (existing) {
                await tx.codePurchase.update({
                    where: { id },
                    data: { ...common, idempotencyKey: `history:blue-panther:${event.key}` },
                });
            } else {
                await tx.codePurchase.create({
                    data: {
                        id,
                        ...common,
                        idempotencyKey: `history:blue-panther:${event.key}`,
                        completedAt: new Date(event.occurredAt),
                        createdAt: new Date(event.occurredAt),
                    },
                });
            }
            const currentTx = current.transactions.find((row) => row.codePurchaseId === id);
            const txData = {
                walletId: WALLET_ID,
                type: WalletTransactionType.CONSUMPTION,
                status: WalletTransactionStatus.CONFIRMED,
                amount: event.amountCop,
                balanceAfter: null,
                originalAmount: event.billedCount * event.denomination,
                originalCurrency: "USD",
                exchangeRate: event.fxRate,
                description: event.codes.length === event.billedCount
                    ? "Buy - Blue Panther"
                    : `${event.billedCount} unidad facturada · ${event.codes.length} códigos registrados`,
                createdById: ACTOR_ID,
                codePurchaseId: id,
            };
            if (currentTx) {
                await tx.walletTransaction.update({ where: { id: currentTx.id }, data: txData });
            } else {
                await tx.walletTransaction.create({
                    data: { id: `bp-hist-wallet-purchase-${event.key}`, ...txData, createdAt: new Date(event.occurredAt) },
                });
            }
        }

        const canonicalMergeId = EXISTING_CANONICAL["20260918-205100-us10"];
        await tx.key.updateMany({ where: { purchaseId: ABSORBED_PURCHASE_ID }, data: { purchaseId: canonicalMergeId } });
        await tx.codePurchase.update({
            where: { id: ABSORBED_PURCHASE_ID },
            data: {
                status: "FAILED",
                fulfillmentStatus: "absorbed",
                deliveredCodes: [],
                lastError: `Consolidada históricamente en ${canonicalMergeId}; referencia Diem preservada.`,
                completedAt: null,
                nextRetryAt: null,
            },
        });
        await tx.codePurchase.update({
            where: { id: DUPLICATE_REQUEST_ID },
            data: {
                status: "FAILED",
                fulfillmentStatus: "duplicate",
                lastError: "Solicitud duplicada anterior a la reconstrucción; sin consumo de wallet.",
                nextRetryAt: null,
            },
        });
        await tx.walletTransaction.updateMany({
            where: { walletId: WALLET_ID, codePurchaseId: ABSORBED_PURCHASE_ID },
            data: { status: WalletTransactionStatus.FAILED, balanceAfter: null },
        });

        const rechargeEvents = manifest.events.filter((event): event is RechargeEvent => event.kind === "recharge");
        for (const event of rechargeEvents) {
            const id = `bp-hist-wallet-recharge-${event.key}`;
            await tx.walletTransaction.upsert({
                where: { id },
                create: {
                    id,
                    walletId: WALLET_ID,
                    type: WalletTransactionType.RECHARGE,
                    status: WalletTransactionStatus.CONFIRMED,
                    method: WalletRechargeMethod.MANUAL,
                    amount: event.amountCop,
                    balanceAfter: null,
                    description: "Payment - Blue Panther",
                    externalReference: event.externalReference ?? null,
                    createdById: ACTOR_ID,
                    createdAt: new Date(event.occurredAt),
                },
                update: {
                    status: WalletTransactionStatus.CONFIRMED,
                    method: WalletRechargeMethod.MANUAL,
                    amount: event.amountCop,
                    balanceAfter: null,
                    description: "Payment - Blue Panther",
                    externalReference: event.externalReference ?? null,
                    createdById: ACTOR_ID,
                },
            });
        }

        const ledger = await tx.walletTransaction.findMany({
            where: { walletId: WALLET_ID },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        });
        let balance = 0;
        for (const row of ledger) {
            if (row.status !== WalletTransactionStatus.CONFIRMED) continue;
            if (row.type === WalletTransactionType.ADJUSTMENT) throw new Error("Se encontró ADJUSTMENT durante apply.");
            if (row.type === WalletTransactionType.RECHARGE || row.type === WalletTransactionType.REFUND) balance += row.amount;
            else if (row.type === WalletTransactionType.CONSUMPTION) balance -= row.amount;
            balance = Math.round(balance * 100) / 100;
            await tx.walletTransaction.update({ where: { id: row.id }, data: { balanceAfter: balance } });
        }
        await tx.wallet.update({ where: { id: WALLET_ID }, data: { balance } });

        const [completed, activations, confirmed, adjustmentCount] = await Promise.all([
            tx.codePurchase.count({ where: { companyId: COMPANY_ID, status: "COMPLETED" } }),
            tx.cardActivation.count({ where: { storeId: STORE_ID } }),
            tx.walletTransaction.findMany({ where: { walletId: WALLET_ID, status: WalletTransactionStatus.CONFIRMED } }),
            tx.walletTransaction.count({ where: { walletId: WALLET_ID, type: WalletTransactionType.ADJUSTMENT } }),
        ]);
        const consumption = confirmed.filter((row) => row.type === WalletTransactionType.CONSUMPTION).reduce((sum, row) => sum + row.amount, 0);
        const recharge = confirmed.filter((row) => row.type === WalletTransactionType.RECHARGE).reduce((sum, row) => sum + row.amount, 0);
        if (completed !== 29 || activations !== 2 || consumption !== EXPECTED_CONSUMPTION || recharge !== EXPECTED_RECHARGE || balance !== EXPECTED_BALANCE || adjustmentCount !== 0) {
            throw new Error(`Postcondición fallida: purchases=${completed}, activations=${activations}, consumption=${consumption}, recharge=${recharge}, balance=${balance}, adjustments=${adjustmentCount}`);
        }
    }, { maxWait: 10_000, timeout: 30_000, isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

async function main() {
    const { mode, values } = parseArgs();
    const manifest = loadManifest(values.get("input")!);
    const snapshot = await loadSnapshot(prisma);
    validateSnapshot(snapshot, manifest);
    const receipt = {
        version: 1,
        manifestSha256: MANIFEST_SHA256,
        databaseFingerprint: snapshot.fingerprint,
        storeCompanyId: snapshot.store!.companyId,
        cards: snapshot.cards.length,
        activatedCards: snapshot.cards.filter((card) => card.isActivated).length,
        purchases: snapshot.purchases.length,
        walletTransactions: snapshot.transactions.length,
        walletBalance: snapshot.wallet!.balance,
        finalState: isFinalState(snapshot, manifest),
    };

    if (mode === "plan") {
        writePrivateJson(values.get("receipt")!, receipt, false);
        console.log(JSON.stringify(receipt));
        console.log("PLAN OK: sin cambios; ningún PIN fue impreso.");
        return;
    }

    const planned = JSON.parse(readFileSync(resolve(values.get("receipt")!), "utf8"));
    if (canonical(planned) !== canonical(receipt)) throw new Error("La base cambió después de plan; ejecuta plan nuevamente.");
    if (receipt.finalState) {
        const noOpReport = {
            version: 1,
            manifestSha256: MANIFEST_SHA256,
            noOp: true,
            purchasesCompleted: 29,
            activations: 2,
            inactiveCards: 18,
            recharges: 6,
            consumptions: 31,
            consumptionCop: EXPECTED_CONSUMPTION,
            rechargeCop: EXPECTED_RECHARGE,
            balanceCop: EXPECTED_BALANCE,
            adjustments: 0,
        };
        writePrivateJson(values.get("report")!, noOpReport, false);
        console.log(JSON.stringify(noOpReport));
        console.log("NO-OP OK: el estado final ya estaba completo; no se escribió ninguna fila.");
        return;
    }
    writePrivateJson(values.get("backup")!, {
        version: 1,
        manifestSha256: MANIFEST_SHA256,
        capturedAt: new Date().toISOString(),
        store: snapshot.store,
        wallet: snapshot.wallet,
        cards: snapshot.cards,
        purchases: snapshot.purchases,
        transactions: snapshot.transactions,
    }, true);

    await applyHistory(manifest, snapshot.fingerprint);
    const final = await loadSnapshot(prisma);
    validateSnapshot(final, manifest);
    const confirmed = final.transactions.filter((row) => row.status === WalletTransactionStatus.CONFIRMED);
    const report = {
        version: 1,
        manifestSha256: MANIFEST_SHA256,
        companyId: COMPANY_ID,
        storeId: STORE_ID,
        purchasesCompleted: final.purchases.filter((row) => row.status === "COMPLETED").length,
        activations: final.cards.filter((row) => row.activation).length,
        inactiveCards: final.cards.filter((row) => !row.isActivated).length,
        recharges: confirmed.filter((row) => row.type === WalletTransactionType.RECHARGE).length,
        consumptions: confirmed.filter((row) => row.type === WalletTransactionType.CONSUMPTION).length,
        consumptionCop: confirmed.filter((row) => row.type === WalletTransactionType.CONSUMPTION).reduce((sum, row) => sum + row.amount, 0),
        rechargeCop: confirmed.filter((row) => row.type === WalletTransactionType.RECHARGE).reduce((sum, row) => sum + row.amount, 0),
        balanceCop: final.wallet!.balance,
        adjustments: final.transactions.filter((row) => row.type === WalletTransactionType.ADJUSTMENT).length,
        deliveredCodeHashes: manifest.events
            .filter((event): event is PurchaseEvent => event.kind === "code_purchase")
            .flatMap((event) => event.codes.map(sha))
            .sort(),
    };
    writePrivateJson(values.get("report")!, report, false);
    console.log(JSON.stringify({ ...report, deliveredCodeHashes: `[${report.deliveredCodeHashes.length} hashes]` }));
    console.log("APPLY OK: reconstrucción validada; ningún PIN fue impreso.");
}

main()
    .catch((error) => {
        console.error(error instanceof Error ? error.message : "Error desconocido");
        process.exitCode = 1;
    })
    .finally(async () => prisma.$disconnect());
