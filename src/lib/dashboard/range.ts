/**
 * Date ranges and buckets for the company dashboard. Days are Colombian days
 * (America/Bogota is a fixed UTC-5, no DST), never the server's UTC day.
 */
const OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DAILY_BUCKETS = 92;
export const MAX_PERIOD_DAYS = 366;

export type DashboardRange = "7d" | "30d" | "all" | "period";
export type Bucket = "day" | "month";

export type ResolvedRange = {
    range: DashboardRange;
    /** Inclusive start instant, or null for "all time". */
    from: Date | null;
    /** Exclusive end instant. */
    to: Date;
    /** Local dates (YYYY-MM-DD) of the first and last day shown. */
    firstDay: string | null;
    lastDay: string;
};

/** YYYY-MM-DD of the Colombian day an instant falls on. */
export function bogotaDay(instant: Date): string {
    return new Date(instant.getTime() - OFFSET_MS).toISOString().slice(0, 10);
}

/** Instant at which a Colombian day starts. */
export function bogotaDayStart(day: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("Fecha inválida");
    const instant = new Date(`${day}T00:00:00.000Z`);
    if (Number.isNaN(instant.getTime()) || instant.toISOString().slice(0, 10) !== day) throw new Error("Fecha inválida");
    return new Date(instant.getTime() + OFFSET_MS);
}

function addDays(day: string, days: number): string {
    return new Date(new Date(`${day}T00:00:00.000Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

export function resolveRange(params: {
    range: string | null;
    from?: string | null;
    to?: string | null;
    now?: Date;
}): ResolvedRange {
    const now = params.now ?? new Date();
    const today = bogotaDay(now);
    const end = bogotaDayStart(addDays(today, 1));
    switch (params.range ?? "30d") {
        case "7d":
            return { range: "7d", from: bogotaDayStart(addDays(today, -6)), to: end, firstDay: addDays(today, -6), lastDay: today };
        case "30d":
            return { range: "30d", from: bogotaDayStart(addDays(today, -29)), to: end, firstDay: addDays(today, -29), lastDay: today };
        case "all":
            return { range: "all", from: null, to: end, firstDay: null, lastDay: today };
        case "period": {
            if (!params.from || !params.to) throw new Error("El período necesita fecha inicial y final");
            const from = bogotaDayStart(params.from);
            const lastStart = bogotaDayStart(params.to);
            if (lastStart < from) throw new Error("La fecha final es anterior a la inicial");
            if ((lastStart.getTime() - from.getTime()) / DAY_MS + 1 > MAX_PERIOD_DAYS) {
                throw new Error(`El período puede tener máximo ${MAX_PERIOD_DAYS} días`);
            }
            return { range: "period", from, to: bogotaDayStart(addDays(params.to, 1)), firstDay: params.from, lastDay: params.to };
        }
        default:
            throw new Error("Rango inválido");
    }
}

/** Daily bars up to ~3 months; longer spans (e.g. all time) by month. */
export function bucketFor(firstDay: string, lastDay: string): Bucket {
    const days = (new Date(`${lastDay}T00:00:00Z`).getTime() - new Date(`${firstDay}T00:00:00Z`).getTime()) / DAY_MS + 1;
    return days > MAX_DAILY_BUCKETS ? "month" : "day";
}

export function bucketKey(day: string, bucket: Bucket): string {
    return bucket === "month" ? day.slice(0, 7) : day;
}

/** Every bucket between two days, zero-filled, so the chart has no gaps. */
export function fillSeries(
    points: { day: string; amount: number }[],
    firstDay: string,
    lastDay: string,
): { bucket: Bucket; series: { key: string; amount: number }[] } {
    const bucket = bucketFor(firstDay, lastDay);
    const totals = new Map<string, number>();
    for (const point of points) {
        const key = bucketKey(point.day, bucket);
        totals.set(key, (totals.get(key) ?? 0) + point.amount);
    }
    const series: { key: string; amount: number }[] = [];
    for (let day = firstDay; day <= lastDay; day = addDays(day, 1)) {
        const key = bucketKey(day, bucket);
        if (series.at(-1)?.key === key) continue;
        series.push({ key, amount: Math.round((totals.get(key) ?? 0) * 100) / 100 });
    }
    return { bucket, series };
}
