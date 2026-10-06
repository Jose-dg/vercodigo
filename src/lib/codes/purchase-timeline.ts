/**
 * Order timeline for a CodePurchase, derived from the persisted row.
 *
 * There is no per-transition history table: only createdAt, completedAt and the
 * current status are stored. Intermediate steps therefore reuse createdAt and
 * the "current" step has no timestamp of its own.
 */

export type TimelineStepKey = "created" | "processing" | "completed";
export type TimelineStepState = "done" | "current" | "pending" | "error";
/** Visual tone of the order as a whole. */
export type TimelineTone = "progress" | "waiting" | "success" | "error";

export interface TimelineStep {
    key: TimelineStepKey;
    label: string;
    at: string | null;
    state: TimelineStepState;
}

export interface PurchaseTimeline {
    steps: TimelineStep[];
    /** 0..1, how much of the progress bar is filled. */
    progress: number;
    tone: TimelineTone;
    /** Short status label for headers and badges. */
    statusLabel: string;
    /** Polling should continue while the order is not terminal. */
    isTerminal: boolean;
}

type DateInput = string | Date | null | undefined;

function iso(value: DateInput): string | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function processingLabel(status: string, fulfillmentStatus?: string | null): string {
    if (status === "AWAITING_STOCK") return "Esperando stock";
    if (status === "ACTION_REQUIRED") {
        return fulfillmentStatus === "pending_review" ? "Revisión operativa" : "Revisión requerida";
    }
    if (status === "FINALIZING") return "Finalizando";
    return "Procesando";
}

export function buildPurchaseTimeline(purchase: {
    status: string;
    fulfillmentStatus?: string | null;
    createdAt: DateInput;
    completedAt?: DateInput;
}): PurchaseTimeline {
    const createdAt = iso(purchase.createdAt);
    const completedAt = iso(purchase.completedAt);
    const created: TimelineStep = { key: "created", label: "Creada", at: createdAt, state: "done" };

    if (purchase.status === "COMPLETED") {
        return {
            steps: [
                created,
                { key: "processing", label: "Procesada", at: createdAt, state: "done" },
                { key: "completed", label: "Completada", at: completedAt, state: "done" },
            ],
            progress: 1,
            tone: "success",
            statusLabel: "Completada",
            isTerminal: true,
        };
    }

    if (purchase.status === "FAILED") {
        return {
            steps: [
                created,
                { key: "processing", label: "Procesada", at: createdAt, state: "done" },
                { key: "completed", label: "Fallida", at: null, state: "error" },
            ],
            progress: 1,
            tone: "error",
            statusLabel: "Fallida",
            isTerminal: true,
        };
    }

    const label = processingLabel(purchase.status, purchase.fulfillmentStatus);
    const waiting = purchase.status === "AWAITING_STOCK" || purchase.status === "ACTION_REQUIRED";
    return {
        steps: [
            created,
            { key: "processing", label, at: createdAt, state: "current" },
            { key: "completed", label: "Completada", at: null, state: "pending" },
        ],
        progress: purchase.status === "FINALIZING" ? 0.85 : 0.66,
        tone: waiting ? "waiting" : "progress",
        statusLabel: label,
        // ACTION_REQUIRED can still be resolved by ops or by the webhook.
        isTerminal: false,
    };
}
