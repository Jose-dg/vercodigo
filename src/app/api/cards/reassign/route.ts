import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AppError, badRequest, forbidden } from "@/lib/errors";
import { reassignCardsToStore } from "@/services/card.service";
import { writeAuditLog } from "@/services/self-service/audit.service";
import { withAuth } from "@/lib/auth/guard";

const ReassignBody = z.object({
    storeId: z.string().min(1),
    uuids: z.array(z.string().min(1)).min(1).max(500),
});

async function handler(
    req: NextRequest,
    _ctx: unknown,
    _ability: unknown,
    user: { id: string; role: string },
) {
    if (user.role !== "SUPER_ADMIN" && user.role !== "SYSTEM_ADMIN") {
        throw forbidden("Solo la plataforma puede reasignar tarjetas entre tiendas");
    }

    try {
        const parsed = ReassignBody.safeParse(await req.json());
        if (!parsed.success) {
            throw badRequest("Payload inválido", parsed.error.issues);
        }

        const result = await reassignCardsToStore({
            uuids: parsed.data.uuids,
            targetStoreId: parsed.data.storeId,
            actorUserId: user.id,
        });

        await writeAuditLog({
            action: "CARD_REASSIGN_STORE",
            userId: user.id,
            companyId: result.targetStore.companyId,
            storeId: result.targetStore.id,
            entityType: "Store",
            entityId: result.targetStore.id,
            after: result,
            details: { uuids: parsed.data.uuids },
            success: true,
        });

        return NextResponse.json({ success: true, ...result });
    } catch (e: unknown) {
        if (e instanceof AppError) {
            return NextResponse.json(
                { error: e.code, message: e.message, details: e.details },
                { status: e.status },
            );
        }
        const message = e instanceof Error ? e.message : "Error inesperado";
        return NextResponse.json({ error: "BAD_REQUEST", message }, { status: 400 });
    }
}

export const POST = withAuth("manage", "all", handler);
