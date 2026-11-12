import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AppError, badRequest, forbidden } from "@/lib/errors";
import { CARD_BULK_OPERATIONS, isPlatformRole } from "@/lib/auth/abilities";
import type { UserRole } from "@prisma/client";
import { withAuth } from "@/lib/auth/guard";
import { BULK_ACTIVATION_MAX_CARDS } from "@/lib/cards/bulk-activation";
import { previewBulkActivation } from "@/services/self-service/bulk-activate-cards.service";

const PreviewBody = z.object({
    uuids: z.array(z.string().min(1)).min(1).max(BULK_ACTIVATION_MAX_CARDS),
});

async function handler(
    req: NextRequest,
    _ctx: unknown,
    _ability: unknown,
    user: { id: string; role: UserRole },
) {
    try {
        if (!isPlatformRole(user.role)) {
            throw forbidden("Solo la plataforma puede activar tarjetas en bloque");
        }
        const parsed = PreviewBody.safeParse(await req.json());
        if (!parsed.success) throw badRequest("Payload inválido", parsed.error.issues);

        const preview = await previewBulkActivation({ uuids: parsed.data.uuids, userId: user.id });
        return NextResponse.json(preview);
    } catch (e: unknown) {
        if (e instanceof AppError) {
            return NextResponse.json(
                { error: e.code, message: e.message, details: e.details },
                { status: e.status },
            );
        }
        console.error("[cards/activate-bulk/preview] Error:", e);
        return NextResponse.json({ error: "INTERNAL", message: "Error inesperado" }, { status: 500 });
    }
}

const [action, subject] = CARD_BULK_OPERATIONS.activate;
export const POST = withAuth(action, subject, handler);
