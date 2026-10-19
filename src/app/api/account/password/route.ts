import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedActor } from "@/lib/auth/actor";
import { AppError } from "@/lib/errors";
import { changeOwnPassword } from "@/modules/identity/password.service";

const Body = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(1).max(200),
});

/** PUT /api/account/password — el usuario cambia su propia contraseña. */
export async function PUT(request: NextRequest) {
    const actor = await getAuthenticatedActor();
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: "BAD_REQUEST", message: "Completa la contraseña actual y la nueva" }, { status: 400 });
    }
    try {
        await changeOwnPassword({ userId: actor.id, ...parsed.data });
        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
        }
        console.error("[account/password]", error);
        return NextResponse.json({ error: "INTERNAL", message: "Error inesperado" }, { status: 500 });
    }
}
