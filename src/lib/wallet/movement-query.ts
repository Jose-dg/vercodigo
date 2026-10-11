import { z } from "zod";

import { badRequest } from "@/lib/errors";

const MOVEMENT_TYPES = ["OPENING_BALANCE", "RECHARGE", "CONSUMPTION", "ADJUSTMENT", "REFUND"] as const;

const MovementQuery = z.object({
    page: z.coerce.number().int().min(1).default(1),
    type: z.enum(MOVEMENT_TYPES).optional(),
    /** Effective-time range, ISO 8601 with offset; `to` is exclusive. */
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional(),
});

export type WalletMovementFilters = {
    page: number;
    type?: (typeof MOVEMENT_TYPES)[number];
    from?: Date;
    to?: Date;
};

/** Parses ?page=&type=&from=&to= of the movement endpoints. */
export function parseMovementQuery(searchParams: URLSearchParams): WalletMovementFilters {
    const parsed = MovementQuery.safeParse({
        page: searchParams.get("page") ?? undefined,
        type: searchParams.get("type") ?? undefined,
        from: searchParams.get("from") ?? undefined,
        to: searchParams.get("to") ?? undefined,
    });
    if (!parsed.success) throw badRequest("Filtros inválidos", parsed.error.issues);
    const from = parsed.data.from ? new Date(parsed.data.from) : undefined;
    const to = parsed.data.to ? new Date(parsed.data.to) : undefined;
    if (from && to && from >= to) throw badRequest("El rango de fechas es inválido");
    return { page: parsed.data.page, type: parsed.data.type, from, to };
}
