import { badRequest } from "../../lib/errors.ts";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export function parseCursorPagination(searchParams: URLSearchParams) {
    const rawLimit = searchParams.get("limit");
    const limit = rawLimit === null ? DEFAULT_LIMIT : Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
        throw badRequest(`limit debe ser un entero entre 1 y ${MAX_LIMIT}`);
    }
    const startingAfter = searchParams.get("starting_after")?.trim() || null;
    return { limit, startingAfter };
}

export function listEnvelope<T>(data: T[], limit: number) {
    const hasMore = data.length > limit;
    const page = hasMore ? data.slice(0, limit) : data;
    const last = page.at(-1) as ({ id?: string } | undefined);
    return {
        object: "list" as const,
        data: page,
        pagination: {
            has_more: hasMore,
            next_cursor: hasMore && last?.id ? last.id : null,
        },
    };
}
