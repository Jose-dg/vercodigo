import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getFinancialMetrics } from '@/lib/analytics/queries';

const querySchema = z.object({
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    storeId: z.string().optional(),
});

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const params = querySchema.parse({
            dateFrom: searchParams.get('dateFrom') || undefined,
            dateTo: searchParams.get('dateTo') || undefined,
            storeId: searchParams.get('storeId') || undefined,
        });

        const data = await getFinancialMetrics(params);

        return NextResponse.json(data, {
            headers: {
                'Cache-Control': 'private, s-maxage=300, stale-while-revalidate=600',
            },
        });
    } catch (error) {
        console.error('API Error (Financial):', error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 });
        }
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
