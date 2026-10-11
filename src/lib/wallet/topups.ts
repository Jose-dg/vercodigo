/**
 * Presentation and validation for wallet top-ups collected by DevDiem.
 * Pure functions: no I/O, safe on server and client.
 */
import type { TopUpState } from '../devdiem/stored-value';

/** Bre-B per-transaction cap set by Banco de la República (COP). */
export const BREB_MAX_PER_TRANSACTION_COP = 12_110_000;
export const TOPUP_MIN_COP = 10_000;
export const TOPUP_QUICK_AMOUNTS_COP = [200_000, 500_000, 1_000_000, 3_000_000];

export type TopUpStatePresentation = {
    label: string;
    description: string;
    tone: 'pending' | 'review' | 'success' | 'muted';
    isOpen: boolean;
};

const STATES: Record<TopUpState, TopUpStatePresentation> = {
    created: {
        label: 'Esperando pago',
        description: 'Haz la transferencia y luego confirma con la referencia de tu banco.',
        tone: 'pending',
        isOpen: true,
    },
    under_review: {
        label: 'En revisión',
        description: 'Recibimos tu reporte. Finanzas lo confirma contra el banco.',
        tone: 'review',
        isOpen: true,
    },
    credited: {
        label: 'Acreditada',
        description: 'El saldo ya está disponible en tu cuenta.',
        tone: 'success',
        isOpen: false,
    },
    failed: {
        label: 'No aprobada',
        description: 'La recarga no se pudo completar. Puedes intentarlo de nuevo.',
        tone: 'muted',
        isOpen: false,
    },
    expired: {
        label: 'Vencida',
        description: 'No recibimos el reporte a tiempo. Crea una nueva recarga.',
        tone: 'muted',
        isOpen: false,
    },
};

export function topUpStatePresentation(state: TopUpState): TopUpStatePresentation {
    return STATES[state] ?? STATES.failed;
}

/**
 * Short code the payer writes in the transfer description. Derived from the
 * DevDiem top-up id, so finance can match a bank movement to a top-up.
 */
export function shortTopUpReference(topUpId: string): string {
    return `VC-${topUpId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

export type AmountValidation = { ok: true; amount: number } | { ok: false; error: string };

export function validateTopUpAmount(input: string | number): AmountValidation {
    const normalized = typeof input === 'number' ? input : Number(String(input).replace(/[^\d]/g, ''));
    if (!Number.isFinite(normalized) || !Number.isInteger(normalized) || normalized <= 0) {
        return { ok: false, error: 'Ingresa un monto en pesos, sin decimales.' };
    }
    if (normalized < TOPUP_MIN_COP) {
        return { ok: false, error: `La recarga mínima es de $${TOPUP_MIN_COP.toLocaleString('es-CO')}.` };
    }
    if (normalized > BREB_MAX_PER_TRANSACTION_COP) {
        return {
            ok: false,
            error: `Bre-B permite hasta $${BREB_MAX_PER_TRANSACTION_COP.toLocaleString('es-CO')} por transferencia. Haz varias recargas.`,
        };
    }
    return { ok: true, amount: normalized };
}

/** Sum of top-ups still in flight (waiting for payment or under review). */
export function openTopUpsTotal(topUps: Array<{ state: TopUpState; amount: string }>): number {
    return topUps
        .filter((topUp) => topUpStatePresentation(topUp.state).isOpen)
        .reduce((sum, topUp) => sum + Number(topUp.amount), 0);
}

export type BalancePreview = {
    after: number;
    /** Part of the top-up that pays existing debt. */
    debtCovered: number;
    /** Debt still pending after the top-up (0 when fully covered). */
    remainingDebt: number;
};

/** What the balance becomes once a top-up of `amount` is credited. */
export function balanceAfterTopUp(balance: number, amount: number): BalancePreview {
    const debt = balance < 0 ? -balance : 0;
    const debtCovered = Math.min(debt, amount);
    return { after: balance + amount, debtCovered, remainingDebt: debt - debtCovered };
}

/**
 * Amount that exactly settles a debt, rounded up to the next thousand pesos.
 * Null when there is no debt or it cannot be paid in one Bre-B transfer.
 */
export function debtSettlementAmount(balance: number): number | null {
    if (balance >= 0) return null;
    const rounded = Math.ceil(-balance / 1000) * 1000;
    const amount = Math.max(rounded, TOPUP_MIN_COP);
    return amount <= BREB_MAX_PER_TRANSACTION_COP ? amount : null;
}

export type TimeRemaining = { expired: boolean; label: string; urgent: boolean };

export function timeRemaining(expiresAt: string, now: Date = new Date()): TimeRemaining {
    const ms = new Date(expiresAt).getTime() - now.getTime();
    if (!Number.isFinite(ms) || ms <= 0) return { expired: true, label: 'Vencida', urgent: true };
    const minutes = Math.floor(ms / 60_000);
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    const mins = minutes % 60;
    const label = days > 0 ? `${days} d ${hours} h` : hours > 0 ? `${hours} h ${mins} min` : `${mins} min`;
    return { expired: false, label, urgent: ms < 2 * 60 * 60_000 };
}

export type TimelineStep = {
    key: 'created' | 'reported' | 'review' | 'credited';
    label: string;
    at: string | null;
    status: 'done' | 'current' | 'upcoming' | 'stopped';
};

/** Where a top-up is, as a four-step timeline for people. */
export function topUpTimeline(topUp: {
    state: TopUpState;
    created_at?: string;
    reported_at?: string | null;
    credited_at?: string | null;
}): TimelineStep[] {
    const reached = {
        created: true,
        reported: Boolean(topUp.reported_at) || topUp.state === 'under_review' || topUp.state === 'credited',
        review: topUp.state === 'under_review' || topUp.state === 'credited',
        credited: topUp.state === 'credited',
    };
    const stopped = topUp.state === 'failed' || topUp.state === 'expired';
    const steps: Array<Omit<TimelineStep, 'status'>> = [
        { key: 'created', label: 'Recarga creada', at: topUp.created_at ?? null },
        { key: 'reported', label: 'Pago reportado', at: topUp.reported_at ?? null },
        { key: 'review', label: 'Verificación de finanzas', at: null },
        { key: 'credited', label: 'Saldo acreditado', at: topUp.credited_at ?? null },
    ];
    const firstPending = steps.findIndex((step) => !reached[step.key]);
    // Exactly one current step: finance review while under review, otherwise
    // the first step not reached yet (none once credited).
    const currentIndex = topUp.state === 'under_review' ? 2 : firstPending;
    return steps.map((step, index) => {
        let status: TimelineStep['status'];
        if (index === currentIndex) status = stopped ? 'stopped' : 'current';
        else if (currentIndex === -1 || index < currentIndex) status = 'done';
        else status = 'upcoming';
        return { ...step, status };
    });
}

/** Plain-text instructions to send to whoever makes the transfer. */
export function topUpInstructionsText(params: {
    amountLabel: string;
    reference: string;
    key?: string;
    expiresLabel: string;
}): string {
    const lines = [
        'Recarga de saldo Vercode por Bre-B',
        `• Monto exacto: ${params.amountLabel}`,
        `• Escribe en la descripción: ${params.reference}`,
    ];
    if (params.key) lines.push(`• Llave Bre-B: ${params.key}`);
    lines.push(`• Págala antes de: ${params.expiresLabel}`);
    lines.push('Después, comparte la referencia que te dé tu banco para confirmar la recarga.');
    return lines.join('\n');
}
