'use client';

import { csvRowIdempotencyKey, type CsvRecipientRow } from '@/lib/codes/recipients-csv';
import type { DeliveryRecipient } from '@/lib/codes/delivery-recipient';

export type BatchPurchasePayload = {
    productId: string;
    denominationId: string | null;
    quotedUnitAmount: number;
    quotedCurrency: string;
    quotedRate?: number | null;
    fileText: string;
    rows: CsvRecipientRow[];
};

export type BatchRowState = {
    line: number;
    recipient: DeliveryRecipient;
    status: 'queued' | 'sending' | 'ok' | 'error';
    orderId: string | null;
    message: string;
};

export const BATCH_CONCURRENCY = 3;

/**
 * Sends one purchase per CSV row through the regular purchase endpoint.
 * Each row's Idempotency-Key comes from the file, product and row number, so a
 * retry (or the same file uploaded again) never buys twice: it resumes.
 */
export async function runRecipientsBatch(params: {
    payload: BatchPurchasePayload;
    /** Body of POST /api/codes/purchase for one row (adds company/origin for the platform). */
    buildBody: (row: CsvRecipientRow) => Record<string, unknown>;
    onRow: (line: number, patch: Partial<BatchRowState>) => void;
}) {
    const queue = [...params.payload.rows];
    const worker = async () => {
        for (let row = queue.shift(); row; row = queue.shift()) {
            params.onRow(row.line, { status: 'sending' });
            try {
                const idempotencyKey = await csvRowIdempotencyKey({
                    fileText: params.payload.fileText,
                    productId: params.payload.productId,
                    denominationId: params.payload.denominationId,
                    line: row.line,
                });
                const response = await fetch('/api/codes/purchase', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
                    body: JSON.stringify(params.buildBody(row)),
                });
                const data = await response.json().catch(() => null);
                if (!response.ok) {
                    params.onRow(row.line, {
                        status: 'error',
                        message: (typeof data?.message === 'string' && data.message) || `Error ${response.status}`,
                    });
                    continue;
                }
                params.onRow(row.line, {
                    status: 'ok',
                    orderId: data?.purchase?.id ?? null,
                    message: data?.purchase?.status === 'COMPLETED' ? 'Enviado' : 'Registrado, en proceso',
                });
            } catch {
                params.onRow(row.line, { status: 'error', message: 'Error de conexión. Reintenta: no se duplica.' });
            }
        }
    };
    await Promise.all(Array.from({ length: BATCH_CONCURRENCY }, worker));
}
