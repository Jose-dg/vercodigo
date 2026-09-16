/**
 * Partner ops client for Diem identity + StoreProduct fulfillment triage.
 * Uses the same service-account credentials as fulfillment.ts.
 */
import { getDiemConfig, type DiemConfig, type DiemHttpError } from './fulfillment';

function headers(config: DiemConfig, extra?: Record<string, string>) {
    return {
        Authorization: `Bearer ${config.apiKey}`,
        Accept: 'application/json',
        ...extra,
    };
}

async function parseJson<T>(response: Response): Promise<T> {
    const text = await response.text();
    let body: unknown = null;
    if (text) {
        try {
            body = JSON.parse(text);
        } catch {
            body = text;
        }
    }
    if (!response.ok) {
        const error = new Error(
            typeof body === 'object' && body && 'detail' in body
                ? String((body as { detail: unknown }).detail)
                : `Diem ops HTTP ${response.status}`,
        ) as DiemHttpError;
        error.status = response.status;
        error.detail = body;
        throw error;
    }
    return body as T;
}

export type OpsClientStatus = 'unclassified' | 'needs_account' | 'operable' | 'all';

export type OpsClientRow = {
    id_client: number;
    name: string;
    last_name: string;
    phone: string;
    document_type: string | null;
    document_number: string | null;
    email: string;
    legal_party_id: string | null;
    legal_party_name: string | null;
    ops_status: 'unclassified' | 'needs_account' | 'operable';
    order_count: number;
};

export type OpsStoreProductRow = {
    store_product_id: string;
    product_id: string;
    name: string;
    sku: string;
    brand: string | null;
    product_type: string;
    country_region: string | null;
    denomination: number | null;
    denomination_currency: string | null;
    status: string;
    fulfillment_enabled: boolean;
    processing_mode: string;
    active_inventory_source_count: number;
    can_enable_fulfillment: boolean;
};

export async function listOpsClients(params: {
    q?: string;
    status?: OpsClientStatus;
}): Promise<OpsClientRow[]> {
    const config = getDiemConfig();
    const query = new URLSearchParams({
        store_id: config.storeId,
        status: params.status ?? 'unclassified',
    });
    if (params.q?.trim()) query.set('q', params.q.trim());
    const response = await fetch(
        `${config.baseUrl}/api/v1/ops/clients/?${query.toString()}`,
        { headers: headers(config), cache: 'no-store' },
    );
    const body = await parseJson<{ results: OpsClientRow[] }>(response);
    return body.results ?? [];
}

export async function prepareOpsClient(params: {
    clientId: number;
    legalName: string;
    partyType: 'natural_person' | 'legal_entity';
    tradeName?: string;
}): Promise<Record<string, unknown>> {
    const config = getDiemConfig();
    const response = await fetch(
        `${config.baseUrl}/api/v1/ops/clients/${params.clientId}/prepare/`,
        {
            method: 'POST',
            headers: headers(config, { 'Content-Type': 'application/json' }),
            body: JSON.stringify({
                store_id: config.storeId,
                legal_name: params.legalName,
                party_type: params.partyType,
                trade_name: params.tradeName ?? '',
                identity_confirmed: true,
            }),
            cache: 'no-store',
        },
    );
    return parseJson(response);
}

export async function listOpsStoreProducts(params: {
    q?: string;
    fulfillmentEnabled?: boolean | null;
    missingSource?: boolean;
}): Promise<OpsStoreProductRow[]> {
    const config = getDiemConfig();
    const query = new URLSearchParams({ store_id: config.storeId });
    if (params.q?.trim()) query.set('q', params.q.trim());
    if (params.fulfillmentEnabled === true) query.set('fulfillment_enabled', 'true');
    if (params.fulfillmentEnabled === false) query.set('fulfillment_enabled', 'false');
    if (params.missingSource) query.set('missing_source', 'true');
    const response = await fetch(
        `${config.baseUrl}/api/v1/ops/store-products/?${query.toString()}`,
        { headers: headers(config), cache: 'no-store' },
    );
    const body = await parseJson<{ results: OpsStoreProductRow[] }>(response);
    return body.results ?? [];
}

export async function setOpsStoreProductFulfillment(params: {
    storeProductId: string;
    enabled: boolean;
}): Promise<{ store_product_id: string; fulfillment_enabled: boolean }> {
    const config = getDiemConfig();
    const response = await fetch(
        `${config.baseUrl}/api/v1/ops/store-products/${encodeURIComponent(params.storeProductId)}/fulfillment/`,
        {
            method: 'POST',
            headers: headers(config, { 'Content-Type': 'application/json' }),
            body: JSON.stringify({ enabled: params.enabled }),
            cache: 'no-store',
        },
    );
    return parseJson(response);
}
