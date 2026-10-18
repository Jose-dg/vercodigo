import "server-only";

import { timingSafeEqual } from "node:crypto";

import type { NotificationRecipient, OrderNotificationTemplate } from "./domain";

/**
 * Cliente de diem-ai para correos transaccionales. Usa lo que diem-ai ya expone:
 * `customers/resolve` (destinatario + opt-in transaccional de email) y `events`
 * con `dispatch: "now"` (se envía en esa solicitud y el resultado llega por
 * callback). Variables: DIEM_AI_BASE_URL (infraestructura), DIEM_AI_INTERNAL_TOKEN
 * (secreto) y DIEM_AI_TENANT_ID (tenant de Vercode en diem-ai).
 */

const REQUEST_TIMEOUT_MS = 5_000;

type DiemAiConfig = { baseUrl: string; token: string; tenantId: string };

function config(): DiemAiConfig | null {
    const baseUrl = process.env.DIEM_AI_BASE_URL?.trim().replace(/\/+$/, "");
    const token = process.env.DIEM_AI_INTERNAL_TOKEN?.trim();
    const tenantId = process.env.DIEM_AI_TENANT_ID?.trim();
    return baseUrl && token && tenantId ? { baseUrl, token, tenantId } : null;
}

export function diemAiConfigured(): boolean {
    return config() !== null;
}

async function post<T>(path: string, body: unknown): Promise<T> {
    const settings = config();
    if (!settings) throw new Error("diem-ai no está configurado");
    const response = await fetch(`${settings.baseUrl}/api/scheduling${path}`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${settings.token}`,
            "X-Tenant-ID": settings.tenantId,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
        const detail = (await response.text().catch(() => "")).slice(0, 300);
        throw new Error(`diem-ai ${path} respondió ${response.status}: ${detail}`);
    }
    return response.json() as Promise<T>;
}

/** Registra (o reutiliza) al destinatario en diem-ai con opt-in transaccional de email. */
export async function resolveRecipient(recipient: NotificationRecipient): Promise<string> {
    const result = await post<{ customer_identity_id: string }>("/customers/resolve", {
        external_source: recipient.role === "diem_team" ? "diem-sas-team" : "diem-sas-user",
        external_id: recipient.key,
        name: recipient.name,
        email: recipient.email,
        // Avisos de cuenta y pedidos: diem-ai lo guarda con alcance "transactional".
        consent: { email: true },
    });
    return result.customer_identity_id;
}

/** Pide el correo: diem-ai lo envía en esta solicitud y confirma por callbackUrl. */
export async function requestEmail(input: {
    customerIdentityId: string;
    template: OrderNotificationTemplate;
    params: Record<string, string>;
    externalRef: string;
    callbackUrl: string;
}): Promise<{ id: string; status: string }> {
    return post("/events", {
        customer_identity_id: input.customerIdentityId,
        scheduled_for: new Date().toISOString(),
        template_name: input.template,
        event_type: input.template,
        title: input.template,
        channel: "email",
        template_params: input.params,
        external_ref: input.externalRef,
        dispatch: "now",
        callback_url: input.callbackUrl,
    });
}

/** El callback de diem-ai viene con el mismo token con el que se le llamó. */
export function isDiemAiCallbackAuthorized(authorization: string | null): boolean {
    const expected = config()?.token;
    const provided = authorization?.replace(/^Bearer\s+/i, "").trim();
    if (!expected || !provided) return false;
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
}
