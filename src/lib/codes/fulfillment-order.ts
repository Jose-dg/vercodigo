/**
 * "Mis solicitudes" shows every Diem fulfillment the operator triggered: code
 * purchases and QR card activations. Both are serialized to one row shape so
 * the list, its lanes and its counters treat them the same way.
 */
import { summarizeCodeDelivery } from "./delivery-counts.ts";

// Same lifecycle discipline as CodePurchase: COMPLETED and FAILED are
// absorbing, and every concurrent write is a compare-and-set on "still open".
export const OPEN_ACTIVATION_JOB_STATUSES = [
    "PENDING",
    "PROCESSING",
    "AWAITING_STOCK",
    "ACTION_REQUIRED",
    "FINALIZING",
];

export type FulfillmentOrderKind = "purchase" | "activation";

export interface FulfillmentOrderRow {
    kind: FulfillmentOrderKind;
    id: string;
    detailHref: string;
    cardUuid: string | null;
    count: number;
    totalAmount: number;
    currency: string;
    status: string;
    fulfillmentStatus: string | null;
    lastError: string | null;
    createdAt: Date;
    occurredAt: Date;
    completedAt: Date | null;
    productName?: string;
    requesterLabel?: string;
    isPending: boolean;
    isSuccessful: boolean;
    needsAction: boolean;
    keys: { code: string }[];
    deliveredCodeCount: number;
    hasDeliveryCountMismatch: boolean;
    denomination: { amount: number; currency: string } | null;
}

export interface ActivationOrderSource {
    card: {
        uuid: string;
        productName: string;
        customAmount: number | null;
        denomination: { amount: number; currency: string } | null;
        keyCode: string | null;
    };
    /** Latest ActivationJob of the card; absent for legacy/WhatsApp activations. */
    job: {
        status: string;
        fulfillmentStatus: string | null;
        lastError: string | null;
        deliveredCodes: unknown;
        commercialAmount: number | null;
        commercialCurrency: string | null;
        createdAt: Date;
    } | null;
    activation: {
        activatedAt: Date;
        commercialAmount: number | null;
        commercialCurrency: string | null;
        activationAmount: number;
    } | null;
    requesterLabel?: string;
}

const PLATFORM_ROLES = new Set(["SUPER_ADMIN", "SYSTEM_ADMIN"]);

/**
 * Who sees which activations. Mirrors buildPurchaseVisibilityFilter: platform
 * sees everything, company admins their company, store staff their store and
 * anyone else only what they activated themselves. `card` is a Card filter.
 */
export type ActivationScope =
    | { kind: "card"; card: { storeId: string } | { store: { companyId: string } } | Record<string, never> }
    | { kind: "user"; userId: string }
    | { kind: "none" };

export function activationScope(
    user: { id: string; role: string; companyId: string | null; storeId: string | null },
    companyIdOverride?: string | null,
): ActivationScope {
    if (PLATFORM_ROLES.has(user.role)) {
        return { kind: "card", card: companyIdOverride ? { store: { companyId: companyIdOverride } } : {} };
    }
    if (user.role === "OWNER" || user.role === "GENERAL_ADMIN") {
        return user.companyId ? { kind: "card", card: { store: { companyId: user.companyId } } } : { kind: "none" };
    }
    if (user.role === "ADMIN" || user.role === "OPERATOR") {
        return user.storeId ? { kind: "card", card: { storeId: user.storeId } } : { kind: "none" };
    }
    return { kind: "user", userId: user.id };
}

export function isOpenActivationStatus(status: string): boolean {
    return OPEN_ACTIVATION_JOB_STATUSES.includes(status);
}

function activationLastError(state: {
    reversed: boolean;
    settled: boolean;
    orphanCompletion: boolean;
    jobError: string | null;
}): string | null {
    if (state.reversed) return state.jobError;
    if (state.settled) return null;
    if (state.orphanCompletion) {
        return "Diem entregó el código pero la activación no quedó registrada ni cobrada. Requiere revisión.";
    }
    return state.jobError;
}

export function serializeActivationOrder(source: ActivationOrderSource): FulfillmentOrderRow {
    const { card, job, activation } = source;
    // A CardActivation is the settled fact (card activated and wallet debited).
    // A COMPLETED job without one means Diem delivered but SAS never settled:
    // surface it for review instead of reporting a delivery.
    const orphanCompletion = !activation && job?.status === "COMPLETED";
    // Diem cancelled the delivery afterwards and the debit was refunded.
    const reversed = job?.status === "REVERSED";
    const status = reversed
        ? "REVERSED"
        : activation ? "COMPLETED" : orphanCompletion ? "ACTION_REQUIRED" : job?.status ?? "PENDING";
    const jobCodes = summarizeCodeDelivery({ status, deliveredCodes: job?.deliveredCodes ?? null }).codes;
    const codes = jobCodes.length ? jobCodes : card.keyCode ? [card.keyCode] : [];
    const denomination = card.denomination
        ?? (card.customAmount != null && activation
            ? { amount: card.customAmount, currency: activation.commercialCurrency ?? "COP" }
            : null);
    const createdAt = job?.createdAt ?? activation!.activatedAt;
    return {
        kind: "activation",
        id: `activation:${card.uuid}`,
        detailHref: `/codes/activations/${encodeURIComponent(card.uuid)}`,
        cardUuid: card.uuid,
        count: 1,
        totalAmount: activation?.commercialAmount ?? job?.commercialAmount ?? activation?.activationAmount ?? 0,
        currency: activation?.commercialCurrency ?? job?.commercialCurrency ?? "COP",
        status,
        fulfillmentStatus: reversed ? job?.fulfillmentStatus ?? "cancelled" : activation ? "delivered" : job?.fulfillmentStatus ?? null,
        lastError: activationLastError({ reversed, settled: Boolean(activation), orphanCompletion, jobError: job?.lastError ?? null }),
        createdAt,
        occurredAt: createdAt,
        completedAt: activation?.activatedAt ?? null,
        productName: card.productName,
        requesterLabel: source.requesterLabel,
        isPending: isOpenActivationStatus(status),
        isSuccessful: status === "COMPLETED",
        needsAction: status === "ACTION_REQUIRED",
        keys: status === "COMPLETED" ? codes.map((code) => ({ code })) : [],
        deliveredCodeCount: codes.length,
        hasDeliveryCountMismatch: status === "COMPLETED" && codes.length !== 1,
        denomination,
    };
}

/** Newest first, capped, then split into the panel's lanes. */
export function laneFulfillmentOrders<T extends Pick<FulfillmentOrderRow, "occurredAt" | "id" | "status" | "isPending" | "isSuccessful" | "needsAction">>(
    rows: T[],
    limit: number,
) {
    const ordered = [...rows]
        .sort((a, b) => (
            new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
            || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0)
        ))
        .slice(0, limit);
    return {
        pending: ordered.filter((row) => row.isPending),
        completed: ordered.filter((row) => row.isSuccessful),
        // REVERSED: delivered, then cancelled by Diem and refunded. Shown here
        // because the delivered codes are no longer valid.
        failed: ordered.filter((row) => row.status === "FAILED" || row.status === "REVERSED" || row.needsAction),
    };
}
