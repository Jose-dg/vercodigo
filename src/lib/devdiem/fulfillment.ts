export type DiemConfig = {
    baseUrl: string;
    apiKey: string;
    storeId: string;
};

export function getDiemConfig(): DiemConfig {
    const configuredUrl = process.env.DIEM_API_URL?.trim();
    const apiKey = process.env.DIEM_SERVICE_API_KEY;
    const storeId = process.env.DIEM_STORE_ID?.trim();
    if (!configuredUrl) throw new Error('DIEM_API_URL no está configurada');
    if (!apiKey?.trim()) throw new Error('DIEM_SERVICE_API_KEY no está configurada');
    if (!storeId) throw new Error('DIEM_STORE_ID no está configurada');

    let parsedUrl: URL;
    try {
        parsedUrl = new URL(configuredUrl);
    } catch {
        throw new Error('DIEM_API_URL no es una URL válida');
    }
    const isLocal = ['localhost', '127.0.0.1', '::1'].includes(parsedUrl.hostname);
    if (parsedUrl.protocol !== 'https:' && !(isLocal && parsedUrl.protocol === 'http:')) {
        throw new Error('DIEM_API_URL debe usar HTTPS, excepto en localhost');
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(storeId)) {
        throw new Error('DIEM_STORE_ID debe ser un UUID válido');
    }

    return {
        baseUrl: configuredUrl.replace(/\/+$/, ''),
        apiKey: apiKey.trim(),
        storeId,
    };
}

function headers(config: DiemConfig, extra?: Record<string, string>) {
    return {
        Authorization: `Bearer ${config.apiKey}`,
        Accept: 'application/json',
        ...extra,
    };
}

async function parse<T>(response: Response): Promise<T> {
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(
            typeof body?.detail === 'string' ? body.detail : `Diem respondió HTTP ${response.status}`,
        ) as Error & { status?: number; detail?: unknown };
        error.status = response.status;
        error.detail = body;
        throw error;
    }
    return body as T;
}

export type FulfillmentStatus =
    | 'received'
    | 'pending_review'
    | 'processing'
    | 'awaiting_stock'
    | 'allocated'
    | 'delivery_pending'
    | 'partially_delivered'
    | 'delivered'
    | 'action_required'
    | 'failed'
    | 'cancelled';

export type CodeRequest = {
    id: string;
    status: FulfillmentStatus;
    external_reference: string;
};

export async function createCodeRequest(params: {
    idempotencyKey: string;
    externalReference: string;
    source: 'partner_api' | 'physical_card';
    productId: string;
    quantity: number;
    recipient: {
        firstName: string;
        lastName?: string;
        email: string;
        phone?: string;
    };
    metadata?: Record<string, unknown>;
}): Promise<CodeRequest> {
    const config = getDiemConfig();
    const response = await fetch(`${config.baseUrl}/api/v1/code-requests/`, {
        method: 'POST',
        headers: headers(config, {
            'Content-Type': 'application/json',
            'Idempotency-Key': params.idempotencyKey,
        }),
        body: JSON.stringify({
            store_id: config.storeId,
            external_reference: params.externalReference,
            source: params.source,
            recipient: {
                first_name: params.recipient.firstName,
                last_name: params.recipient.lastName ?? '',
                email: params.recipient.email,
                phone: params.recipient.phone ?? '',
            },
            items: [{
                product_id: params.productId,
                quantity: params.quantity,
                allocation_policy: 'all_or_nothing',
            }],
            preferred_channel: 'email',
            delivery_mode: 'partner_retrieval',
            metadata: {
                application: 'diem-sas',
                ...params.metadata,
            },
        }),
    });
    return parse<CodeRequest>(response);
}

export async function getCodeRequest(requestId: string): Promise<CodeRequest> {
    const config = getDiemConfig();
    const response = await fetch(
        `${config.baseUrl}/api/v1/code-requests/${encodeURIComponent(requestId)}/`,
        { headers: headers(config), cache: 'no-store' },
    );
    return parse<CodeRequest>(response);
}

export async function revealCodeRequest(
    requestId: string,
    correlationId: string,
): Promise<string[]> {
    const config = getDiemConfig();
    const response = await fetch(
        `${config.baseUrl}/api/v1/code-requests/${encodeURIComponent(requestId)}/reveal/`,
        {
            method: 'POST',
            headers: headers(config, {
                'Content-Type': 'application/json',
                'X-Correlation-ID': correlationId,
            }),
            body: '{}',
            cache: 'no-store',
        },
    );
    const body = await parse<{ items: Array<{ codes: string[] }> }>(response);
    return body.items.flatMap((item) => item.codes);
}

export async function checkDiemConnection(): Promise<{
    ok: true;
    storeId: string;
    catalogProducts: number;
    catalogProductIds: string[];
}> {
    const config = getDiemConfig();
    const query = new URLSearchParams({
        store_id: config.storeId,
        fulfillment_enabled: 'true',
        page_size: '100',
    });
    let nextUrl: string | null =
        `${config.baseUrl}/api/v1/catalog/products/?${query.toString()}`;
    const productIds = new Set<string>();
    let pageCount = 0;
    while (nextUrl) {
        if (++pageCount > 50) throw new Error('El catálogo de Diem excede el límite de páginas');
        const response: Response = await fetch(nextUrl, {
            headers: headers(config),
            cache: 'no-store',
        });
        const body: unknown = await parse<unknown>(response);
        const rows = Array.isArray(body)
            ? body
            : (
                body
                && typeof body === 'object'
                && Array.isArray((body as { results?: unknown }).results)
            )
                ? (body as { results: unknown[] }).results
                : [];
        for (const row of rows) {
            if (
                row
                && typeof row === 'object'
                && typeof (row as { product_id?: unknown }).product_id === 'string'
            ) {
                productIds.add((row as { product_id: string }).product_id);
            }
        }
        const next: string | null = (
            !Array.isArray(body)
            && body
            && typeof body === 'object'
            && typeof (body as { next?: unknown }).next === 'string'
        )
            ? (body as { next: string }).next
            : null;
        if (!next) {
            nextUrl = null;
            continue;
        }
        const parsedNext: URL = new URL(next, config.baseUrl);
        if (parsedNext.origin !== new URL(config.baseUrl).origin) {
            throw new Error('Diem devolvió una URL de paginación fuera de su dominio');
        }
        nextUrl = parsedNext.toString();
    }
    return {
        ok: true,
        storeId: config.storeId,
        catalogProducts: productIds.size,
        catalogProductIds: [...productIds],
    };
}
