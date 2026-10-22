import "server-only";

import { NextRequest, NextResponse } from "next/server";

import { AppError } from "@/lib/errors";
import { InvalidApiKeyError, bearerToken, type ApiKeyScope } from "@/modules/api-keys/domain";
import {
    authenticateApiKey,
    consumeApiRateLimit,
    type ApiKeyPrincipal,
} from "@/modules/api-keys/service";

type ApiKeyHandler<TContext> = (
    req: NextRequest,
    context: TContext,
    principal: ApiKeyPrincipal,
) => Promise<NextResponse>;

export function apiError(status: number, error: string, message: string, headers?: Record<string, string>) {
    return NextResponse.json({ error, message }, { status, headers });
}

/**
 * Guards a public API v1 route with a company API key (Authorization: Bearer).
 * Separate from withAuth, which only knows Clerk sessions.
 */
export function withApiKey<TContext>(scope: ApiKeyScope, handler: ApiKeyHandler<TContext>) {
    return async (req: NextRequest, context: TContext) => {
        try {
            const token = bearerToken(req.headers.get("authorization"));
            if (!token) {
                return apiError(401, "UNAUTHORIZED", "Falta el header Authorization: Bearer <API key>");
            }
            const principal = await authenticateApiKey(token);
            if (!principal.scopes.includes(scope)) {
                return apiError(403, "FORBIDDEN", `La API key no tiene el permiso ${scope}`);
            }
            const retryAfter = await consumeApiRateLimit(principal.apiKeyId);
            if (retryAfter !== null) {
                return apiError(429, "RATE_LIMIT", "Demasiadas peticiones. Intenta de nuevo en unos segundos.", {
                    "Retry-After": String(retryAfter),
                });
            }
            return await handler(req, context, principal);
        } catch (error) {
            if (error instanceof InvalidApiKeyError) {
                return apiError(401, "UNAUTHORIZED", error.message);
            }
            if (error instanceof AppError) {
                return apiError(error.status, error.code, error.message);
            }
            console.error("[api/v1] unexpected error", error);
            return apiError(500, "INTERNAL", "Error inesperado");
        }
    };
}
