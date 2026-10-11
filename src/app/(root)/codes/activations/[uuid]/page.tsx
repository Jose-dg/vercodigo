'use client';

import { use } from 'react';
import { FulfillmentOrderPage } from '@/components/codes/FulfillmentOrderPage';

export default function ActivationDetailPage({ params }: { params: Promise<{ uuid: string }> }) {
    const { uuid } = use(params);
    return <FulfillmentOrderPage apiPath={`/api/codes/activations/${encodeURIComponent(uuid)}`} />;
}
