import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getBillingMetrics } from '@/lib/analytics/queries';
import { withAuth } from "@/lib/auth/guard";

const querySchema = z.object({
    storeId: z.string().optional(),
});

async function handler(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const params = querySchema.parse({
            storeId: searchParams.get('storeId') || undefined,
        });

        const data = await getBillingMetrics(params);

        return NextResponse.json(data, {
            headers: {
                'Cache-Control': 'private, s-maxage=300, stale-while-revalidate=600',
            },
        });
    } catch (error) {
        console.error('API Error (Billing):', error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 });
        }
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

// Platform analytics: global data across companies, platform roles only.
export const GET = withAuth("read", "AuditLog", handler);
