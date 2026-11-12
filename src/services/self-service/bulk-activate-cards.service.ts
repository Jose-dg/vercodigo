import prisma from "@/lib/prisma";
import { badRequest } from "@/lib/errors";
import { BULK_ACTIVATION_CHUNK_SIZE, BULK_ACTIVATION_MAX_CARDS } from "@/lib/cards/bulk-activation";
import { parseCardCodes } from "@/lib/cards/card-uuid";
import { OPEN_ACTIVATION_JOB_STATUSES } from "@/lib/codes/fulfillment-order";
import { resolveCost } from "@/services/costing/costing.service";
import { assertCanActivateCard } from "./permissions.service";
import {
    evaluateCardActivation,
    findActivatableCards,
    startCardActivation,
    type ActivatableCard,
    type CardActivationQuote,
} from "./activate-card.service";

/**
 * Platform-only bulk activation of physical cards (a client pays a whole
 * stock at once instead of activating each card at the counter).
 *
 * The UI validates the full list once, then sends small chunks in sequence:
 * each card still costs a synchronous Diem call, so chunks keep every request
 * inside the serverless time budget, and a chunk can be re-sent safely because
 * activated or in-progress cards are skipped.
 */

function memoize<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
    const cache = new Map<string, Promise<R>>();
    return (...args: A) => {
        const key = JSON.stringify(args);
        let value = cache.get(key);
        if (!value) {
            value = fn(...args);
            cache.set(key, value);
        }
        return value;
    };
}

function normalizeOrThrow(uuids: string[], max: number) {
    const { codes, invalid } = parseCardCodes(uuids.join("\n"));
    if (invalid.length) {
        throw badRequest(`Códigos QR inválidos: ${invalid.slice(0, 20).join(", ")}`, { invalid });
    }
    if (!codes.length) throw badRequest("Debes indicar al menos un código QR");
    if (codes.length > max) throw badRequest(`Máximo ${max} códigos QR por solicitud`);
    return codes;
}

async function openJobCardIds(cardIds: string[]) {
    const rows = await prisma.activationJob.findMany({
        where: { cardId: { in: cardIds }, status: { in: OPEN_ACTIVATION_JOB_STATUSES } },
        select: { cardId: true },
    });
    return new Set(rows.map((row) => row.cardId));
}

export async function previewBulkActivation(params: { uuids: string[]; userId: string }) {
    const uuids = normalizeOrThrow(params.uuids, BULK_ACTIVATION_MAX_CARDS);
    const cards = await findActivatableCards(uuids);
    const byUuid = new Map(cards.map((card) => [card.uuid, card]));
    const missing = uuids.filter((uuid) => !byUuid.has(uuid));
    const inProgress = await openJobCardIds(cards.map((card) => card.id));

    const cachedCost = memoize(resolveCost);
    const cachedPermission = memoize((storeId: string, companyId: string) =>
        assertCanActivateCard({ userId: params.userId, storeId, companyId }));

    const rows = [];
    for (const uuid of uuids) {
        const card = byUuid.get(uuid);
        if (!card) continue;
        const row = await evaluateCardActivation(card, {
            userId: params.userId,
            resolveCost: cachedCost,
            assertPermission: (c: ActivatableCard) => cachedPermission(c.storeId, c.store.companyId),
        });
        if (row.canActivate && (card.activationLock || inProgress.has(card.id))) {
            row.canActivate = false;
            row.blockReason = "En proceso de activación";
        }
        rows.push(row);
    }

    const eligible = rows.filter((row) => row.canActivate);
    return {
        requested: uuids.length,
        missing,
        cards: rows,
        eligibleCount: eligible.length,
        blockedCount: rows.length - eligible.length,
        companies: await summarizeByCompany(eligible),
    };
}

type EligibleRow = Awaited<ReturnType<typeof evaluateCardActivation>>;

/**
 * Totals per company and billing currency, with the wallet balance it would
 * leave. Debits never block on balance today (negative = debt), so this is a
 * warning for the operator, not a gate. The projection is only computed when
 * the billing currency matches the wallet currency.
 */
async function summarizeByCompany(rows: EligibleRow[]) {
    const groups = new Map<string, { companyId: string; company: string; totals: Map<string, number>; count: number }>();
    for (const row of rows) {
        const group = groups.get(row.companyId)
            ?? { companyId: row.companyId, company: row.company, totals: new Map(), count: 0 };
        const currency = (row.billingCurrency ?? "USD").toUpperCase();
        group.totals.set(currency, (group.totals.get(currency) ?? 0) + (row.billingAmount ?? 0));
        group.count += 1;
        groups.set(row.companyId, group);
    }
    const wallets = await prisma.wallet.findMany({
        where: { companyId: { in: [...groups.keys()] } },
        select: { companyId: true, currency: true, balance: true },
    });
    const walletByCompany = new Map(wallets.map((wallet) => [wallet.companyId, wallet]));

    return [...groups.values()].map((group) => {
        const wallet = walletByCompany.get(group.companyId);
        const walletCurrency = (wallet?.currency ?? "COP").toUpperCase();
        const totals = [...group.totals].map(([currency, amount]) => ({ currency, amount }));
        const onlyWalletCurrency = totals.length === 1 && totals[0].currency === walletCurrency;
        const balance = wallet?.balance ?? 0;
        return {
            companyId: group.companyId,
            company: group.company,
            count: group.count,
            totals,
            wallet: {
                currency: walletCurrency,
                balance,
                balanceAfter: onlyWalletCurrency ? balance - totals[0].amount : null,
            },
        };
    });
}

export type BulkActivationItem = { uuid: string } & CardActivationQuote;

export type BulkActivationResult = {
    uuid: string;
    outcome: "COMPLETED" | "PROCESSING" | "SKIPPED" | "FAILED";
    status: string | null;
    jobId: string | null;
    message: string | null;
};

/**
 * Activates one chunk in sequence. A failing card never stops the rest; each
 * one reports its own outcome. No per-card notifications are sent: the
 * operator hands the client the exported result instead of hundreds of messages.
 */
export async function activateCardsChunk(params: { items: BulkActivationItem[]; userId: string }) {
    const uuids = normalizeOrThrow(params.items.map((item) => item.uuid), BULK_ACTIVATION_CHUNK_SIZE);
    const quotes = new Map<string, CardActivationQuote>();
    for (const item of params.items) {
        const [uuid] = parseCardCodes(item.uuid).codes;
        if (uuid) quotes.set(uuid, item);
    }
    const cards = await findActivatableCards(uuids);
    const byUuid = new Map(cards.map((card) => [card.uuid, card]));
    const inProgress = await openJobCardIds(cards.map((card) => card.id));

    const results: BulkActivationResult[] = [];
    for (const uuid of uuids) {
        const card = byUuid.get(uuid);
        if (!card) {
            results.push({ uuid, outcome: "FAILED", status: null, jobId: null, message: "Tarjeta no encontrada" });
            continue;
        }
        if (card.isActivated) {
            results.push({ uuid, outcome: "SKIPPED", status: null, jobId: null, message: "Ya activada" });
            continue;
        }
        if (card.activationLock || inProgress.has(card.id)) {
            results.push({ uuid, outcome: "SKIPPED", status: null, jobId: null, message: "En proceso de activación" });
            continue;
        }
        results.push(await activateOne(card, params.userId, quotes.get(uuid)));
    }
    return { results };
}

async function activateOne(
    card: ActivatableCard,
    userId: string,
    quote: CardActivationQuote | undefined,
): Promise<BulkActivationResult> {
    try {
        const result = await startCardActivation({ card, userId, quote });
        const jobId = "jobId" in result && typeof result.jobId === "string" ? result.jobId : null;
        const status = "status" in result && typeof result.status === "string" ? result.status : null;
        if (!result.success) {
            const message = "message" in result && typeof result.message === "string" ? result.message : null;
            return { uuid: card.uuid, outcome: "FAILED", status, jobId, message };
        }
        if (status === "COMPLETED") {
            return { uuid: card.uuid, outcome: "COMPLETED", status, jobId, message: null };
        }
        return {
            uuid: card.uuid,
            outcome: "PROCESSING",
            status,
            jobId,
            message: status === "AWAITING_STOCK" ? "Sin stock en Diem; se entrega al llegar inventario" : null,
        };
    } catch (error) {
        return {
            uuid: card.uuid,
            outcome: "FAILED",
            status: null,
            jobId: null,
            message: error instanceof Error ? error.message : "Error inesperado",
        };
    }
}
