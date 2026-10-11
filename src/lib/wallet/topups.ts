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
