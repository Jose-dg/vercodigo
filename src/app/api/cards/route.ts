import { NextRequest, NextResponse } from 'next/server';
import { forbidden } from '@/lib/errors';
import { isPlatformRole } from '@/lib/auth/abilities';
import { withAuth } from '@/lib/auth/guard';
import { getCardsPaginated } from '@/services/card.service';

async function handler(
    req: NextRequest,
    _ctx: unknown,
    _ability: unknown,
    user: { role: string },
) {
    if (!isPlatformRole(user.role as any)) {
        throw forbidden('Solo la plataforma puede consultar tarjetas para remisión');
    }

    const params = req.nextUrl.searchParams;
    const page = Math.max(1, Number(params.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, Number(params.get('limit') || '25')));
    const storeId = (params.get('storeId') || '').trim() || undefined;
    const search = (params.get('search') || '').trim() || undefined;
    const activatedParam = params.get('isActivated');
    const isActivated = activatedParam === 'true'
        ? true
        : activatedParam === 'false'
            ? false
            : undefined;

    const result = await getCardsPaginated({
        page,
        limit,
        storeId,
        search,
        isActivated,
    });

    return NextResponse.json(result);
}

export const GET = withAuth('read', 'Card', handler);
