import { NextRequest, NextResponse } from 'next/server';

import prisma from '@/lib/prisma';
import { syncPendingCredits } from '@/services/wallet/gateway-topup.service';

function isAuthorized(request: NextRequest) {
    const secret = process.env.CRON_SECRET;
    return Boolean(secret && request.headers.get('authorization') === `Bearer ${secret}`);
}

/**
 * GET /api/jobs/wallet-topups — records credited top-ups that no user session
 * synced yet (e.g. finance confirmed while nobody had the portal open).
 */
export async function GET(request: NextRequest) {
    if (!isAuthorized(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const companies = await prisma.company.findMany({ where: { isActive: true }, select: { id: true } });
    const stats = await syncPendingCredits(companies.map((company) => company.id));
    return NextResponse.json(stats);
}
