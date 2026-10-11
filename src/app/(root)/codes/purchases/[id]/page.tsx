'use client';

import { use } from 'react';
import { FulfillmentOrderPage } from '@/components/codes/FulfillmentOrderPage';

export default function CodePurchaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    return <FulfillmentOrderPage apiPath={`/api/codes/purchases/${encodeURIComponent(id)}`} />;
}
