import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { AppError } from "@/lib/errors";
import { withAuth } from "@/lib/auth/guard";
import type { AppAbility } from "@/lib/auth/abilities";
import type { AuthenticatedActor } from "@/lib/auth/actor";
import { createApiKey, listApiKeys } from "@/modules/api-keys/service";

function errorResponse(error: unknown, scope: string) {
    if (error instanceof AppError) {
        return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    }
    console.error(`[api-keys] ${scope}`, error);
    return NextResponse.json({ error: "INTERNAL", message: "Error inesperado" }, { status: 500 });
}

export const GET = withAuth("read", "ApiKey", async (
    _req: NextRequest,
    _ctx: unknown,
    _ability: AppAbility,
    user: AuthenticatedActor,
) => {
    try {
        return NextResponse.json({ apiKeys: await listApiKeys(user) });
    } catch (error) {
        return errorResponse(error, "list");
    }
});

const CreateBody = z.object({
    name: z.string(),
    scopes: z.array(z.string()),
    environment: z.enum(["LIVE", "SANDBOX"]),
    expiresAt: z.string().datetime().nullable().optional(),
});

export const POST = withAuth("create", "ApiKey", async (
    req: NextRequest,
    _ctx: unknown,
    _ability: AppAbility,
    user: AuthenticatedActor,
) => {
    try {
        const parsed = CreateBody.safeParse(await req.json().catch(() => null));
        if (!parsed.success) {
            return NextResponse.json({ error: "BAD_REQUEST", message: "Payload inválido" }, { status: 400 });
        }
        const created = await createApiKey(user, {
            name: parsed.data.name,
            scopes: parsed.data.scopes,
            environment: parsed.data.environment,
            expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
        });
        // The only response that ever contains the key in clear.
        return NextResponse.json(created, { status: 201, headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        return errorResponse(error, "create");
    }
});
