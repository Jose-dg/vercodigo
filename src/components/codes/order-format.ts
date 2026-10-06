import type { TimelineTone } from '@/lib/codes/purchase-timeline';

export function formatMoney(amount: number, currency: string): string {
    try {
        return new Intl.NumberFormat(currency === 'COP' ? 'es-CO' : 'en-US', {
            style: 'currency',
            currency,
            minimumFractionDigits: currency === 'COP' ? 0 : 2,
            maximumFractionDigits: currency === 'COP' ? 0 : 4,
        }).format(amount);
    } catch {
        return `${amount.toLocaleString('es-CO')} ${currency}`;
    }
}

export function formatShortWhen(value: string | null | undefined): string {
    if (!value) return '—';
    return new Intl.DateTimeFormat('es-CO', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(new Date(value));
}

export function formatLongWhen(value: string | null | undefined): string {
    if (!value) return '—';
    return new Intl.DateTimeFormat('es-CO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(new Date(value));
}

/** Short, human order reference derived from the cuid. */
export function orderReference(id: string): string {
    return `#${id.slice(-6).toUpperCase()}`;
}

export const TONE_STYLES: Record<
    TimelineTone,
    { text: string; dot: string; bar: string; border: string }
> = {
    progress: {
        text: 'text-amber-600 dark:text-amber-400',
        dot: 'bg-amber-500',
        bar: 'from-muted-foreground/40 via-amber-400 to-amber-500',
        border: 'border-l-amber-500',
    },
    waiting: {
        text: 'text-orange-600 dark:text-orange-400',
        dot: 'bg-orange-500',
        bar: 'from-muted-foreground/40 via-orange-400 to-orange-500',
        border: 'border-l-orange-500',
    },
    success: {
        text: 'text-emerald-600 dark:text-emerald-400',
        dot: 'bg-emerald-500',
        bar: 'from-muted-foreground/40 via-emerald-400 to-emerald-500',
        border: 'border-l-emerald-500',
    },
    error: {
        text: 'text-destructive',
        dot: 'bg-destructive',
        bar: 'from-muted-foreground/40 via-red-400 to-destructive',
        border: 'border-l-destructive',
    },
};
