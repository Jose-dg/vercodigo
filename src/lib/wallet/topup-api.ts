import { NextResponse } from 'next/server';

import type { DiemHttpError } from '@/lib/devdiem/fulfillment';

/** Maps a DevDiem error to a portal response without leaking internals. */
export function topUpErrorResponse(error: unknown, logContext: string) {
    const diem = error as DiemHttpError;
    if (typeof diem?.status === 'number' && diem.status >= 400 && diem.status < 500) {
        const detail = diem.detail as { code?: string; detail?: string } | undefined;
        return NextResponse.json(
            { error: detail?.code ?? 'TOPUP_REJECTED', message: detail?.detail ?? diem.message },
            { status: diem.status === 404 ? 404 : 422 },
        );
    }
    console.error(`[wallet-topups] ${logContext}`, error);
    return NextResponse.json(
        { error: 'TOPUP_UNAVAILABLE', message: 'Las recargas no están disponibles en este momento.' },
        { status: 503 },
    );
}

export type CompanyScope =
    | { ok: true; companyId: string }
    | { ok: false; response: NextResponse };

export function companyOrForbidden(user: { companyId: string | null }): CompanyScope {
    if (user.companyId) return { ok: true, companyId: user.companyId };
    return {
        ok: false,
        response: NextResponse.json(
            { error: 'FORBIDDEN', message: 'Usuario sin compañía asignada' },
            { status: 403 },
        ),
    };
}
