import type { CodeSample } from './code-block';

/** curl / Node / Python versions of one request, so every page shows the same three. */
export function requestSamples(params: {
    baseUrl: string;
    method: 'GET' | 'POST';
    path: string;
    body?: unknown;
    idempotencyKey?: string;
}): CodeSample[] {
    const url = `${params.baseUrl}${params.path}`;
    const json = params.body === undefined ? null : JSON.stringify(params.body, null, 2);

    const curl = [
        `curl -X ${params.method} "${url}" \\`,
        `  -H "Authorization: Bearer $DIEM_API_KEY"${json || params.idempotencyKey ? ' \\' : ''}`,
        ...(params.idempotencyKey ? [`  -H "Idempotency-Key: ${params.idempotencyKey}"${json ? ' \\' : ''}`] : []),
        ...(json ? ['  -H "Content-Type: application/json" \\', `  -d '${json}'`] : []),
    ].join('\n');

    const nodeHeaders = [
        '    Authorization: `Bearer ${process.env.DIEM_API_KEY}`,',
        ...(params.idempotencyKey ? [`    "Idempotency-Key": "${params.idempotencyKey}",`] : []),
        ...(json ? ['    "Content-Type": "application/json",'] : []),
    ].join('\n');
    const node = [
        `const response = await fetch("${url}", {`,
        `  method: "${params.method}",`,
        '  headers: {',
        nodeHeaders,
        '  },',
        ...(json ? [`  body: JSON.stringify(${json.replace(/\n/g, '\n  ')}),`] : []),
        '});',
        'const data = await response.json();',
    ].join('\n');

    const pythonHeaders = [
        '        "Authorization": f"Bearer {os.environ[\'DIEM_API_KEY\']}",',
        ...(params.idempotencyKey ? [`        "Idempotency-Key": "${params.idempotencyKey}",`] : []),
    ].join('\n');
    const python = [
        'import os, requests',
        '',
        `response = requests.${params.method.toLowerCase()}(`,
        `    "${url}",`,
        '    headers={',
        pythonHeaders,
        '    },',
        ...(json ? [`    json=${json.replace(/\n/g, '\n    ').replace(/\btrue\b/g, 'True').replace(/\bfalse\b/g, 'False').replace(/\bnull\b/g, 'None')},`] : []),
        '    timeout=30,',
        ')',
        'data = response.json()',
    ].join('\n');

    return [
        { label: 'curl', code: curl },
        { label: 'Node.js', code: node },
        { label: 'Python', code: python },
    ];
}

export const json = (value: unknown): CodeSample[] => [{ label: 'Respuesta', code: JSON.stringify(value, null, 2) }];

/** Shared by the create and retrieve pages. */
export const DELIVERY_EXAMPLE = {
    id: 'cmv1k2delivery',
    object: 'delivery',
    status: 'completed',
    product: { id: 'cmprod_netflix', name: 'Netflix Gift Card' },
    denomination_id: 'cmden_netflix_20',
    quantity: 1,
    total: { amount: 85000, currency: 'COP' },
    recipient: { first_name: 'Luis', last_name: 'Gómez', email: 'luis@cliente.co' },
    email_delivery: 'sent',
    created_at: '2026-10-22T15:04:05.000Z',
    completed_at: '2026-10-22T15:04:07.000Z',
};
