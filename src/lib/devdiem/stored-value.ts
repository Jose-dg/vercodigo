/**
 * Recargas de saldo de empresas (Vercode) cobradas y verificadas por DevDiem.
 *
 * DevDiem es la autoridad del cobro: crea la recarga, muestra cómo pagar
 * (llave o QR Bre-B), recibe el reporte y una persona de finanzas la confirma.
 * diem-sas no guarda copia de las recargas: las lee de DevDiem y solo registra
 * en su billetera (Prisma) las que DevDiem reporta como acreditadas.
 * Ver diem/docs/billetera/DIEM_SAS_A_Y_B.md (camino A).
 */
import { buildCommercialAccountCode, getDiemConfig, headers, parse } from './fulfillment';

export type TopUpState = 'created' | 'under_review' | 'credited' | 'failed' | 'expired';

export type TopUpAction = {
    kind: 'redirect' | 'display_qr' | 'display_key';
    url?: string;
    key?: string;
    qr_payload?: string;
    expires_at?: string;
};

export type TopUp = {
    id: string;
    status: string;
    state: TopUpState;
    amount: string;
    bonus_amount: string;
    currency: string;
    method_type: string;
    action: TopUpAction | null;
    expires_at: string;
    succeeded_at: string | null;
    created_at?: string;
    reported_at?: string | null;
    credited_at?: string | null;
    gateway_transaction_id?: string;
    partner_acknowledged_at?: string | null;
    /** Receipts attached and not deleted; only finance can open them. */
    evidence_count?: number;
};

/** A receipt already validated by the portal, forwarded to DevDiem as is. */
export type EvidenceUpload = { name: string; data: Blob };

export type StoredValueConfig = {
    channel: string;
    paymentMethodId: number;
    methodType: string;
    returnUrl: string;
};

export function getStoredValueConfig(): StoredValueConfig {
    const channel = process.env.DIEM_STORED_VALUE_CHANNEL?.trim();
    const paymentMethodId = Number(process.env.DIEM_TOPUP_PAYMENT_METHOD_ID);
    const methodType = (process.env.DIEM_TOPUP_METHOD_TYPE || 'BRE_B_MANUAL').trim();
    const returnUrl = process.env.DIEM_TOPUP_RETURN_URL?.trim();
    if (!channel) throw new Error('DIEM_STORED_VALUE_CHANNEL no está configurada');
    if (!Number.isInteger(paymentMethodId) || paymentMethodId < 1) {
        throw new Error('DIEM_TOPUP_PAYMENT_METHOD_ID no está configurada');
    }
    if (!returnUrl) throw new Error('DIEM_TOPUP_RETURN_URL no está configurada');
    return { channel, paymentMethodId, methodType, returnUrl };
}

function accountPath(companyId: string) {
    const config = getDiemConfig();
    const code = encodeURIComponent(buildCommercialAccountCode(companyId));
    return { config, base: `${config.baseUrl}/api/v1/stored-value/partner/accounts/${code}` };
}

export async function listTopUps(companyId: string, opts?: { pendingCredit?: boolean }): Promise<TopUp[]> {
    const { config, base } = accountPath(companyId);
    const query = opts?.pendingCredit ? '?pending_credit=1' : '';
    const response = await fetch(`${base}/topups/list/${query}`, {
        headers: headers(config),
        cache: 'no-store',
    });
    const body = await parse<{ results: TopUp[] }>(response);
    return body.results;
}

export async function createTopUp(params: {
    companyId: string;
    amount: string;
    payerEmail: string;
    acceptedTerms: boolean;
    idempotencyKey: string;
}): Promise<TopUp> {
    const settings = getStoredValueConfig();
    const { config, base } = accountPath(params.companyId);
    const response = await fetch(`${base}/topups/`, {
        method: 'POST',
        headers: headers(config, {
            'Content-Type': 'application/json',
            'Idempotency-Key': params.idempotencyKey,
        }),
        body: JSON.stringify({
            channel: settings.channel,
            payment_method_id: settings.paymentMethodId,
            method_type: settings.methodType,
            amount: params.amount,
            payer_email: params.payerEmail,
            accept_terms: params.acceptedTerms,
            accept_personal_data: params.acceptedTerms,
            return_url: settings.returnUrl,
        }),
    });
    return parse<TopUp>(response);
}

export async function getTopUp(companyId: string, topUpId: string): Promise<TopUp> {
    const { config, base } = accountPath(companyId);
    const response = await fetch(`${base}/topups/${encodeURIComponent(topUpId)}/`, {
        headers: headers(config),
        cache: 'no-store',
    });
    return parse<TopUp>(response);
}

function evidenceForm(files: EvidenceUpload[]): FormData {
    const form = new FormData();
    for (const file of files) form.append('files', file.data, file.name);
    return form;
}

/**
 * "Ya pagué" with the bank reference and, optionally, receipts in the same
 * request (all or nothing). Idempotent in DevDiem for the same reference.
 */
export async function reportTopUp(
    companyId: string,
    topUpId: string,
    bankReference: string,
    files: EvidenceUpload[] = [],
): Promise<TopUp> {
    const { config, base } = accountPath(companyId);
    const url = `${base}/topups/${encodeURIComponent(topUpId)}/report/`;
    if (files.length === 0) {
        const response = await fetch(url, {
            method: 'POST',
            headers: headers(config, { 'Content-Type': 'application/json' }),
            body: JSON.stringify({ bank_reference: bankReference }),
        });
        return parse<TopUp>(response);
    }
    const form = evidenceForm(files);
    form.append('bank_reference', bankReference);
    // No Content-Type: fetch sets multipart/form-data with its boundary.
    const response = await fetch(url, { method: 'POST', headers: headers(config), body: form });
    return parse<TopUp>(response);
}

/** Adds receipts to a top-up already reported and still under review. */
export async function attachTopUpEvidence(
    companyId: string,
    topUpId: string,
    files: EvidenceUpload[],
): Promise<TopUp> {
    const { config, base } = accountPath(companyId);
    const response = await fetch(`${base}/topups/${encodeURIComponent(topUpId)}/evidence/`, {
        method: 'POST',
        headers: headers(config),
        body: evidenceForm(files),
    });
    return parse<TopUp>(response);
}

export async function acknowledgeTopUp(
    companyId: string,
    topUpId: string,
    partnerReference: string,
): Promise<void> {
    const { config, base } = accountPath(companyId);
    const response = await fetch(`${base}/topups/${encodeURIComponent(topUpId)}/acknowledge/`, {
        method: 'POST',
        headers: headers(config, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ partner_reference: partnerReference }),
    });
    await parse<unknown>(response);
}
