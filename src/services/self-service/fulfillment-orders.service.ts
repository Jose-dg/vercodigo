import { Prisma } from "@prisma/client";

import prisma from "@/lib/prisma";
import { conflict, notFound } from "@/lib/errors";
import { buildPurchaseTimeline } from "@/lib/codes/purchase-timeline";
import {
    OPEN_ACTIVATION_JOB_STATUSES,
    activationScope,
    laneFulfillmentOrders,
    serializeActivationOrder,
    type ActivationOrderSource,
} from "@/lib/codes/fulfillment-order";
import { processActivationJob } from "@/services/self-service/activate-card.service";
import {
    listSerializedCodePurchases,
    type Actor,
} from "@/services/self-service/purchase-codes.service";

const cardSelect = {
    id: true,
    uuid: true,
    customAmount: true,
    product: { select: { name: true, brand: true, category: true } },
    denomination: { select: { amount: true, currency: true } },
    key: { select: { code: true } },
} satisfies Prisma.CardSelect;

const activationSelect = {
    activatedAt: true,
    activatedBy: true,
    commercialAmount: true,
    commercialCurrency: true,
    activationAmount: true,
} satisfies Prisma.CardActivationSelect;

const jobSelect = {
    id: true,
    userId: true,
    status: true,
    fulfillmentStatus: true,
    lastError: true,
    deliveredCodes: true,
    commercialAmount: true,
    commercialCurrency: true,
    createdAt: true,
} satisfies Prisma.ActivationJobSelect;

type CardRow = Prisma.CardGetPayload<{ select: typeof cardSelect }>;
type ActivationRow = Prisma.CardActivationGetPayload<{ select: typeof activationSelect }>;
type JobRow = Prisma.ActivationJobGetPayload<{ select: typeof jobSelect }>;

async function requesterLabels(ids: Array<string | null | undefined>) {
    const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
    if (!unique.length) return new Map<string, string>();
    const users = await prisma.user.findMany({
        where: { id: { in: unique } },
        select: { id: true, name: true, email: true },
    });
    return new Map(users.map((row) => [row.id, row.name?.trim() || row.email]));
}

function toSource(
    card: CardRow,
    job: JobRow | null,
    activation: ActivationRow | null,
    labels: Map<string, string>,
): ActivationOrderSource {
    // WhatsApp activations store the phone number in activatedBy.
    const requester = activation?.activatedBy ?? job?.userId ?? null;
    return {
        card: {
            uuid: card.uuid,
            productName: card.product.name,
            customAmount: card.customAmount,
            denomination: card.denomination,
            keyCode: card.key?.code ?? null,
        },
        job,
        activation,
        requesterLabel: requester ? labels.get(requester) ?? requester : undefined,
    };
}

async function listActivationOrders(user: Actor, params: { limit: number; companyId?: string | null }) {
    const scope = activationScope(user, params.companyId);
    if (scope.kind === "none") return [];
    const activationWhere: Prisma.CardActivationWhereInput = scope.kind === "card"
        ? { card: scope.card }
        : { activatedBy: scope.userId };
    // Unsettled jobs only: once a CardActivation exists it is the source of truth.
    const jobWhere: Prisma.ActivationJobWhereInput = scope.kind === "card"
        ? { card: { ...scope.card, activation: { is: null } } }
        : { userId: scope.userId, card: { activation: { is: null } } };

    const [activations, jobs] = await Promise.all([
        prisma.cardActivation.findMany({
            where: activationWhere,
            orderBy: { activatedAt: "desc" },
            take: params.limit,
            select: {
                ...activationSelect,
                card: {
                    select: {
                        ...cardSelect,
                        activationJobs: { orderBy: { createdAt: "desc" }, take: 1, select: jobSelect },
                    },
                },
            },
        }),
        prisma.activationJob.findMany({
            where: jobWhere,
            orderBy: { createdAt: "desc" },
            take: params.limit * 2,
            select: { ...jobSelect, cardId: true, card: { select: cardSelect } },
        }),
    ]);

    const latestJobByCard = new Map<string, (typeof jobs)[number]>();
    for (const job of jobs) if (!latestJobByCard.has(job.cardId)) latestJobByCard.set(job.cardId, job);

    const labels = await requesterLabels([
        ...activations.map((row) => row.activatedBy),
        ...[...latestJobByCard.values()].map((row) => row.userId),
    ]);

    return [
        ...activations.map(({ card, ...activation }) => {
            const { activationJobs, ...cardRow } = card;
            return serializeActivationOrder(toSource(cardRow, activationJobs[0] ?? null, activation, labels));
        }),
        ...[...latestJobByCard.values()].map(({ card, ...job }) => (
            serializeActivationOrder(toSource(card, job, null, labels))
        )),
    ];
}

/** Code purchases and QR activations the actor can see, in the panel's lanes. */
export async function listFulfillmentOrdersForUser(
    user: Actor,
    params?: { limit?: number; companyId?: string | null },
) {
    const limit = Math.min(Math.max(params?.limit ?? 40, 1), 100);
    const [purchases, activations] = await Promise.all([
        listSerializedCodePurchases(user, { limit, companyId: params?.companyId }),
        listActivationOrders(user, { limit, companyId: params?.companyId }),
    ]);
    return laneFulfillmentOrders([...purchases, ...activations], limit);
}

async function findVisibleCard(user: Actor, cardUuid: string) {
    const scope = activationScope(user);
    if (scope.kind === "none") throw notFound("Activación no encontrada");
    const where: Prisma.CardWhereInput = scope.kind === "card"
        ? { uuid: cardUuid, ...scope.card }
        : {
            uuid: cardUuid,
            OR: [
                { activation: { is: { activatedBy: scope.userId } } },
                { activationJobs: { some: { userId: scope.userId } } },
            ],
        };
    const card = await prisma.card.findFirst({
        where,
        select: {
            ...cardSelect,
            activation: { select: { id: true, ...activationSelect } },
            activationJobs: { orderBy: { createdAt: "desc" }, take: 1, select: jobSelect },
        },
    });
    if (!card || (!card.activation && !card.activationJobs.length)) {
        throw notFound("Activación no encontrada");
    }
    return card;
}

/** Same shape as getCodePurchaseForUser so OrderDetail renders both. */
export async function getActivationOrderForUser(user: Actor, cardUuid: string) {
    const card = await findVisibleCard(user, cardUuid);
    const { activation, activationJobs, ...cardRow } = card;
    const job = activationJobs[0] ?? null;
    const [labels, walletTransactions] = await Promise.all([
        requesterLabels([activation?.activatedBy, job?.userId]),
        activation
            ? prisma.walletTransaction.findMany({
                where: { cardActivationId: activation.id, status: { in: ["CONFIRMED", "PENDING"] } },
                orderBy: { createdAt: "asc" },
                select: {
                    id: true,
                    type: true,
                    status: true,
                    amount: true,
                    balanceAfter: true,
                    description: true,
                    createdAt: true,
                    wallet: { select: { currency: true } },
                },
            })
            : Promise.resolve([]),
    ]);
    const row = serializeActivationOrder(toSource(cardRow, job, activation, labels));
    return {
        ...row,
        productBrand: card.product.brand,
        productCategory: card.product.category,
        productImageUrl: null,
        unitPrice: row.totalAmount,
        timeline: buildPurchaseTimeline(row),
        walletTransactions: walletTransactions.map(({ wallet, ...transaction }) => ({
            ...transaction,
            currency: wallet.currency,
        })),
    };
}

/** Re-queries Diem for the card's open activation job (the panel's retry). */
export async function retryActivationOrderForUser(user: Actor, cardUuid: string) {
    const card = await findVisibleCard(user, cardUuid);
    const job = card.activationJobs[0];
    if (card.activation || !job || !OPEN_ACTIVATION_JOB_STATUSES.includes(job.status)) {
        throw conflict("Esta activación no tiene una solicitud abierta en Diem.");
    }
    return processActivationJob(job.id);
}
