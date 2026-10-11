import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { withAuth } from '@/lib/auth/guard';
import type { AuthenticatedActor } from '@/lib/auth/actor';
import { createTopUp, listTopUps } from '@/lib/devdiem/stored-value';
import { companyOrForbidden, topUpErrorResponse } from '@/lib/wallet/topup-api';
import { validateTopUpAmount } from '@/lib/wallet/topups';

/** GET /api/wallet/topups — the company's top-ups, read from DevDiem. */
async function list(_req: NextRequest, _ctx: unknown, _ability: unknown, user: AuthenticatedActor) {
    const scope = companyOrForbidden(user);
    if (!scope.ok) return scope.response;
    const { companyId } = scope;
    try {
        return NextResponse.json({ topUps: await listTopUps(companyId) });
    } catch (error) {
        return topUpErrorResponse(error, 'list');
    }
}

const createSchema = z.object({
    amount: z.union([z.number(), z.string()]),
    acceptedTerms: z.literal(true),
});

/** POST /api/wallet/topups — opens a top-up; DevDiem returns how to pay. */
async function create(req: NextRequest, _ctx: unknown, _ability: unknown, user: AuthenticatedActor) {
    const scope = companyOrForbidden(user);
    if (!scope.ok) return scope.response;
    const { companyId } = scope;
    const idempotencyKey = req.headers.get('idempotency-key')?.trim();
    if (!idempotencyKey) {
        return NextResponse.json({ error: 'IDEMPOTENCY_KEY_REQUIRED' }, { status: 400 });
    }
    const parsed = createSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json(
            { error: 'INVALID', message: 'Indica el monto y acepta las condiciones de la recarga.' },
            { status: 400 },
        );
    }
    const amount = validateTopUpAmount(parsed.data.amount);
    if (!amount.ok) {
        return NextResponse.json({ error: 'INVALID_AMOUNT', message: amount.error }, { status: 400 });
    }
    try {
        const topUp = await createTopUp({
            companyId,
            amount: amount.amount.toFixed(2),
            payerEmail: user.email,
            acceptedTerms: true,
            idempotencyKey: `vercode:${companyId}:${idempotencyKey}`.slice(0, 200),
        });
        return NextResponse.json({ topUp }, { status: 201 });
    } catch (error) {
        return topUpErrorResponse(error, 'create');
    }
}

export const GET = withAuth('read', 'WalletTopUp', list);
export const POST = withAuth('create', 'WalletTopUp', create);
