import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AppError, badRequest, forbidden } from "@/lib/errors";
import { CARD_BULK_OPERATIONS, isPlatformRole } from "@/lib/auth/abilities";
import type { UserRole } from "@prisma/client";
import { withAuth } from "@/lib/auth/guard";
import { extractRequestContext } from "@/lib/request-context";
import { writeAuditLog } from "@/services/self-service/audit.service";
import { BULK_ACTIVATION_CHUNK_SIZE } from "@/lib/cards/bulk-activation";
import { activateCardsChunk } from "@/services/self-service/bulk-activate-cards.service";

// Each card is a synchronous Diem call; a chunk of 10 fits any Vercel plan.
export const maxDuration = 60;

const ChunkBody = z.object({
    items: z
        .array(
            z.object({
                uuid: z.string().min(1),
                quotedAmount: z.number().positive().optional(),
                quotedCurrency: z.string().min(1).max(12).optional(),
                quotedRate: z.number().positive().nullable().optional(),
            }),
        )
        .min(1)
        .max(BULK_ACTIVATION_CHUNK_SIZE),
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
        const parsed = ChunkBody.safeParse(await req.json());
        if (!parsed.success) throw badRequest("Payload inválido", parsed.error.issues);

        const { results } = await activateCardsChunk({ items: parsed.data.items, userId: user.id });

        const reqCtx = extractRequestContext(req);
        await writeAuditLog({
            action: "CARD_BULK_ACTIVATE",
            userId: user.id,
            entityType: "Card",
            ipAddress: reqCtx.ipAddress,
            userAgent: reqCtx.userAgent,
            details: { results },
            success: results.every((row) => row.outcome !== "FAILED"),
        });

        return NextResponse.json({ results });
    } catch (e: unknown) {
        if (e instanceof AppError) {
            return NextResponse.json(
                { error: e.code, message: e.message, details: e.details },
                { status: e.status },
            );
        }
        console.error("[cards/activate-bulk] Error:", e);
        return NextResponse.json({ error: "INTERNAL", message: "Error inesperado" }, { status: 500 });
    }
}

const [action, subject] = CARD_BULK_OPERATIONS.activate;
export const POST = withAuth(action, subject, handler);
