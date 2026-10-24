import { NextRequest, NextResponse } from "next/server";

import { AppError } from "@/lib/errors";
import { withAuth } from "@/lib/auth/guard";
import type { AppAbility } from "@/lib/auth/abilities";
import type { AuthenticatedActor } from "@/lib/auth/actor";
import { deleteApiKey, revokeApiKey } from "@/modules/api-keys/service";

const handle = (operation: "revoke" | "delete") => withAuth("delete", "ApiKey", async (
    _req: NextRequest,
    context: { params: Promise<{ id: string }> },
    _ability: AppAbility,
    user: AuthenticatedActor,
) => {
    try {
        const { id } = await context.params;
        if (operation === "revoke") {
            return NextResponse.json({ apiKey: await revokeApiKey(user, id) });
        }
        await deleteApiKey(user, id);
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
        }
        console.error(`[api-keys] ${operation}`, error);
        return NextResponse.json({ error: "INTERNAL", message: "Error inesperado" }, { status: 500 });
    }
});

export const PATCH = handle("revoke");
export const DELETE = handle("delete");
