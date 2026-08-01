import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AppError, badRequest, forbidden } from '@/lib/errors';
import { isPlatformRole } from '@/lib/auth/abilities';
import { withAuth } from '@/lib/auth/guard';
import { lookupCardsForReassign } from '@/services/card.service';

const LookupBody = z.object({
    uuids: z.array(z.string()).min(1).max(500),
});

async function handler(
    req: NextRequest,
    _ctx: unknown,
    _ability: unknown,
    user: { role: string },
) {
    if (!isPlatformRole(user.role as any)) {
        throw forbidden('Solo la plataforma puede consultar tarjetas para remisión');
    }

    try {
        const parsed = LookupBody.safeParse(await req.json());
        if (!parsed.success) {
            throw badRequest('Payload inválido', parsed.error.issues);
        }

        const result = await lookupCardsForReassign(parsed.data.uuids);
        return NextResponse.json(result);
    } catch (e: unknown) {
        if (e instanceof AppError) {
            return NextResponse.json(
                { error: e.code, message: e.message, details: e.details },
                { status: e.status },
            );
        }
        const message = e instanceof Error ? e.message : 'Error inesperado';
        return NextResponse.json({ error: 'BAD_REQUEST', message }, { status: 400 });
    }
}

export const POST = withAuth('read', 'Card', handler);
