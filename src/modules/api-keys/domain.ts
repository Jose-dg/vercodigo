/**
 * API keys de empresa para la API v1. Mismo esquema que los service accounts de
 * DevDiem (apps/tenancy/service_accounts.py):
 *
 *   vck_live_<prefijo: 12 hex>_<secreto: 32 bytes base64url>
 *
 * El prefijo es público (búsqueda y UI). Solo se guarda HMAC-SHA256(pepper, key):
 * sin API_KEY_PEPPER una copia de la base no permite validar ni fabricar keys.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const API_KEY_SCOPES = [
    "catalog:read",
    "deliveries:create",
    "deliveries:read",
    "wallet:read",
] as const;

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

export const API_KEY_SCOPE_LABELS: Record<ApiKeyScope, string> = {
    "catalog:read": "Consultar catálogo y precios",
    "deliveries:create": "Crear entregas (compra con cargo a la billetera)",
    "deliveries:read": "Consultar entregas",
    "wallet:read": "Consultar saldo",
};

export const MAX_ACTIVE_API_KEYS = 5;
export const API_RATE_LIMIT_PER_MINUTE = 60;

const KEY_PATTERN = /^vck_live_([0-9a-f]{12})_([A-Za-z0-9_-]{43})$/;

export class InvalidApiKeyError extends Error {
    constructor() {
        // Siempre el mismo mensaje: no revela si existe el prefijo, si venció o si fue revocada.
        super("API key inválida");
    }
}

export type GeneratedApiKey = { key: string; prefix: string };

export function generateApiKey(): GeneratedApiKey {
    const prefix = randomBytes(6).toString("hex");
    const secret = randomBytes(32).toString("base64url");
    return { key: `vck_live_${prefix}_${secret}`, prefix };
}

/** The public prefix of a well-formed key, or null. */
export function apiKeyPrefixOf(key: string): string | null {
    return KEY_PATTERN.exec(key.trim())?.[1] ?? null;
}

export function hashApiKey(key: string, pepper: string): string {
    if (pepper.length < 32) throw new Error("API_KEY_PEPPER debe tener al menos 32 caracteres");
    return createHmac("sha256", pepper).update(key.trim()).digest("hex");
}

export function apiKeyMatches(key: string, storedHash: string, pepper: string): boolean {
    const computed = Buffer.from(hashApiKey(key, pepper), "hex");
    const stored = Buffer.from(storedHash, "hex");
    return computed.length === stored.length && timingSafeEqual(computed, stored);
}

export function bearerToken(header: string | null): string | null {
    const match = /^Bearer\s+(\S+)\s*$/i.exec(header ?? "");
    return match ? match[1] : null;
}

export function normalizeScopes(input: unknown): ApiKeyScope[] {
    if (!Array.isArray(input)) return [];
    const allowed = new Set<string>(API_KEY_SCOPES);
    return API_KEY_SCOPES.filter((scope) => input.includes(scope) && allowed.has(scope));
}

/** What the UI may show of a key: never the hash. */
export function displayApiKey(prefix: string): string {
    return `vck_live_${prefix}_••••`;
}
