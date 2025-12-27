import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getLifecycleMetrics } from '@/lib/analytics/queries';

const querySchema = z.object({
    storeId: z.string().optional(),
});

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const params = querySchema.parse({
            storeId: searchParams.get('storeId') || undefined,
        });

        const data = await getLifecycleMetrics(params);

        return NextResponse.json(data, {
            headers: {
                'Cache-Control': 'private, s-maxage=300, stale-while-revalidate=600',
            },
        });
    } catch (error) {
        console.error('API Error (Lifecycle):', error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 });
        }
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
