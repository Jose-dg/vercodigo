import prisma from "@/lib/prisma";
import { tooMany } from "@/lib/errors";

type Action = "ACTIVATION";

const LIMITS: Record<
    Action,
    { perMinute: number; perHour: number; perDay: number }
> = {
    ACTIVATION: { perMinute: 10, perHour: 100, perDay: 500 },
};

const floorMinute = (d: Date) =>
    new Date(
        d.getFullYear(),
        d.getMonth(),
        d.getDate(),
        d.getHours(),
        d.getMinutes(),
        0,
        0
    );

const floorHour = (d: Date) =>
    new Date(
        d.getFullYear(),
        d.getMonth(),
        d.getDate(),
        d.getHours(),
        0,
        0,
        0
    );

const floorDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);

export async function checkRateLimit(params: {
    userId: string;
    storeId?: string | null;
    action: Action;
}) {
    const now = new Date();
    const windows = [
        {
            tag: "MINUTE",
            start: floorMinute(now),
            limit: LIMITS[params.action].perMinute,
        },
        {
            tag: "HOUR",
            start: floorHour(now),
            limit: LIMITS[params.action].perHour,
        },
        {
            tag: "DAY",
            start: floorDay(now),
            limit: LIMITS[params.action].perDay,
        },
    ] as const;

    for (const w of windows) {
        const actionKey = `${params.action}_${w.tag}`;

        const row = await prisma.rateLimitLog.upsert({
            where: {
                userId_action_windowStart: {
                    userId: params.userId,
                    action: actionKey,
                    windowStart: w.start,
                },
            },
            update: { count: { increment: 1 } },
            create: {
                userId: params.userId,
                storeId: params.storeId ?? null,
                action: actionKey,
                windowStart: w.start,
                count: 1,
            },
            select: { count: true },
        });

        if (row.count > w.limit)
            throw tooMany(
                `Límite excedido (${params.action} ${w.tag}). Intenta más tarde.`
            );
    }
}
