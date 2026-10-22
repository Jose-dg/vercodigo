import { formatMoney as formatWalletMoney } from '@/lib/wallet/balance';

export type DashboardData = {
    currency: string;
    kpis: { balance: number; orders: number; completedOrders: number; totalSpent: number; deposited: number };
    stats: {
        range: '7d' | '30d' | 'all' | 'period';
        firstDay: string;
        lastDay: string;
        orders: number;
        completedOrders: number;
        spent: number;
        bucket: 'day' | 'month';
        series: { key: string; amount: number }[];
        byService: { service: string; label: string; amount: number; orders: number }[];
        topProducts: {
            productId: string;
            name: string;
            brand: string | null;
            denomination: { amount: number; currency: string } | null;
            region: string | null;
            amount: number;
            orders: number;
        }[];
    };
    recentOrders: {
        id: string;
        kind: 'purchase' | 'activation';
        date: string;
        productName: string;
        brand: string | null;
        denomination: { amount: number; currency: string } | null;
        channel: 'portal' | 'api' | 'qr';
        status: string;
        amount: number;
        currency: string;
        recipientEmail: string | null;
    }[];
};

/** Money in the wallet currency: COP without decimals, others with two. */
export function money(amount: number, currency: string): string {
    return formatWalletMoney(amount, currency, currency === 'COP' ? 0 : 2);
}

export function compactMoney(amount: number, currency: string): string {
    try {
        return new Intl.NumberFormat(currency === 'COP' ? 'es-CO' : 'en-US', {
            style: 'currency',
            currency,
            notation: 'compact',
            maximumFractionDigits: 1,
        }).format(amount);
    } catch {
        return String(Math.round(amount));
    }
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];

/** "24 sept" for a day bucket, "sept 2026" for a month bucket. */
export function bucketLabel(key: string, bucket: 'day' | 'month'): string {
    const [year, month, day] = key.split('-');
    const name = MONTHS[Number(month) - 1] ?? month;
    return bucket === 'month' ? `${name} ${year}` : `${Number(day)} ${name}`;
}

export function shortDateTime(iso: string): string {
    return new Intl.DateTimeFormat('es-CO', {
        timeZone: 'America/Bogota',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(new Date(iso));
}
