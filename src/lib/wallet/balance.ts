/**
 * How a company's wallet balance is read by people. A negative balance is an
 * obligation to Vercode; a positive one is credit available for purchases.
 * Single source for the wallet page and the top bar indicator.
 */
export type BalanceTone = 'debt' | 'credit' | 'settled';

export type BalancePresentation = {
    label: string;
    shortLabel: string;
    description: string;
    amount: number;
    tone: BalanceTone;
};

export function balancePresentation(balance: number): BalancePresentation {
    if (balance < 0) {
        return {
            label: 'Total pendiente',
            shortLabel: 'Pendiente',
            description: 'Consumos confirmados pendientes de abono a Vercode.',
            amount: Math.abs(balance),
            tone: 'debt',
        };
    }
    if (balance > 0) {
        return {
            label: 'Saldo a favor',
            shortLabel: 'Disponible',
            description: 'Saldo disponible para cubrir próximos consumos.',
            amount: balance,
            tone: 'credit',
        };
    }
    return {
        label: 'Cuenta al día',
        shortLabel: 'Al día',
        description: 'No tienes saldo pendiente ni saldo a favor.',
        amount: 0,
        tone: 'settled',
    };
}

export const BALANCE_TONE_CLASS: Record<BalanceTone, string> = {
    debt: 'text-red-700 dark:text-red-400',
    credit: 'text-emerald-700 dark:text-emerald-400',
    settled: 'text-[#123f68] dark:text-sky-300',
};

export function formatMoney(amount: number, currency: string, fractionDigits = 0): string {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency,
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
    }).format(amount);
}
