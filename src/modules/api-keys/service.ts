import { Prisma, type UserRole } from "@prisma/client";

import prisma from "@/lib/prisma";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { writeAuditLog } from "@/services/self-service/audit.service";
import {
    API_RATE_LIMIT_PER_MINUTE,
    InvalidApiKeyError,
    MAX_ACTIVE_API_KEYS,
    apiKeyMatches,
    apiKeyPrefixOf,
    displayApiKey,
    generateApiKey,
    hashApiKey,
    normalizeScopes,
    type ApiKeyScope,
} from "./domain";

/** Roles that may hold a key: the key acts as its creator, so the creator must still be one. */
const KEY_OWNER_ROLES = new Set<UserRole>(["OWNER", "GENERAL_ADMIN"]);
const PLATFORM_ROLES = new Set<UserRole>(["SUPER_ADMIN", "SYSTEM_ADMIN"]);
const LAST_USED_RESOLUTION_MS = 60_000;

export type ApiKeyActor = { id: string; role: UserRole; companyId: string | null };

function pepper(): string {
    const value = process.env.API_KEY_PEPPER?.trim();
    if (!value) throw new Error("API_KEY_PEPPER no está configurada");
    return value;
}

function companyScope(actor: ApiKeyActor, companyId?: string | null): string {
    if (PLATFORM_ROLES.has(actor.role)) {
        if (!companyId) throw badRequest("Indica la compañía");
        return companyId;
    }
    if (!actor.companyId) throw forbidden("Tu usuario no pertenece a una compañía");
    if (companyId && companyId !== actor.companyId) throw forbidden("No puedes gestionar keys de otra compañía");
    return actor.companyId;
}

const publicSelect = {
    id: true,
    companyId: true,
    name: true,
    keyPrefix: true,
    scopes: true,
    lastUsedAt: true,
    expiresAt: true,
    revokedAt: true,
    createdAt: true,
    createdBy: { select: { name: true, email: true } },
    revokedBy: { select: { name: true, email: true } },
} satisfies Prisma.CompanyApiKeySelect;

type PublicRow = Prisma.CompanyApiKeyGetPayload<{ select: typeof publicSelect }>;

function serializeApiKey(row: PublicRow, now = new Date()) {
    const expired = row.expiresAt !== null && row.expiresAt <= now;
    return {
        id: row.id,
        name: row.name,
        displayKey: displayApiKey(row.keyPrefix),
        scopes: row.scopes,
        createdAt: row.createdAt,
        createdBy: row.createdBy.name?.trim() || row.createdBy.email,
        lastUsedAt: row.lastUsedAt,
        expiresAt: row.expiresAt,
        revokedAt: row.revokedAt,
        revokedBy: row.revokedBy ? row.revokedBy.name?.trim() || row.revokedBy.email : null,
        status: row.revokedAt ? "revoked" as const : expired ? "expired" as const : "active" as const,
    };
}

export type PublicApiKey = ReturnType<typeof serializeApiKey>;

function activeWhere(companyId: string, now: Date): Prisma.CompanyApiKeyWhereInput {
    return {
        companyId,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    };
}

export async function listApiKeys(actor: ApiKeyActor, companyId?: string | null) {
    const scope = companyScope(actor, companyId);
    const rows = await prisma.companyApiKey.findMany({
        where: { companyId: scope },
        select: publicSelect,
        orderBy: [{ revokedAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }],
    });
    const now = new Date();
    return rows.map((row) => serializeApiKey(row, now));
}

/**
 * Creates a key and returns it in clear exactly once. Only a company OWNER or
 * GENERAL_ADMIN creates keys: the key acts as that person (role and purchase
 * origin), so the platform cannot mint one on a company's behalf.
 */
export async function createApiKey(
    actor: ApiKeyActor,
    input: { name: unknown; scopes: unknown; expiresAt?: Date | null },
): Promise<{ key: string; apiKey: PublicApiKey }> {
    if (!KEY_OWNER_ROLES.has(actor.role) || !actor.companyId) {
        throw forbidden("Solo el dueño o un administrador general de la compañía puede crear API keys");
    }
    const companyId = actor.companyId;
    const name = typeof input.name === "string" ? input.name.trim().replace(/\s+/g, " ") : "";
    if (!name || name.length > 80) throw badRequest("El nombre es obligatorio (máximo 80 caracteres)");
    const scopes = normalizeScopes(input.scopes);
    if (!scopes.length) throw badRequest("Elige al menos un permiso");
    const now = new Date();
    if (input.expiresAt && input.expiresAt <= now) throw badRequest("La fecha de vencimiento ya pasó");

    for (let attempt = 0; attempt < 3; attempt += 1) {
        const generated = generateApiKey();
        try {
            const row = await prisma.$transaction(async (tx) => {
                // Serializes concurrent creations of one company so the limit holds.
                await tx.$queryRaw`SELECT id FROM "Company" WHERE id = ${companyId} FOR UPDATE`;
                const active = await tx.companyApiKey.count({ where: activeWhere(companyId, now) });
                if (active >= MAX_ACTIVE_API_KEYS) {
                    throw conflict(`La compañía ya tiene ${MAX_ACTIVE_API_KEYS} API keys activas. Revoca una antes de crear otra.`);
                }
                return tx.companyApiKey.create({
                    data: {
                        companyId,
                        name,
                        keyPrefix: generated.prefix,
                        keyHash: hashApiKey(generated.key, pepper()),
                        scopes,
                        createdById: actor.id,
                        expiresAt: input.expiresAt ?? null,
                    },
                    select: publicSelect,
                });
            });
            await writeAuditLog({
                action: "API_KEY_CREATED",
                userId: actor.id,
                companyId,
                entityType: "CompanyApiKey",
                entityId: row.id,
                after: { name, keyPrefix: row.keyPrefix, scopes, expiresAt: row.expiresAt },
            });
            return { key: generated.key, apiKey: serializeApiKey(row, now) };
        } catch (error) {
            const prefixCollision = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
            if (!prefixCollision) throw error;
        }
    }
    throw new Error("No se pudo generar una API key única");
}

/** Idempotent: revoking an already revoked key returns it unchanged. */
export async function revokeApiKey(actor: ApiKeyActor, apiKeyId: string) {
    const key = await prisma.companyApiKey.findUnique({ where: { id: apiKeyId }, select: { companyId: true } });
    if (!key) throw notFound("API key no encontrada");
    if (!PLATFORM_ROLES.has(actor.role) && key.companyId !== actor.companyId) {
        throw notFound("API key no encontrada");
    }
    const revoked = await prisma.companyApiKey.updateMany({
        where: { id: apiKeyId, revokedAt: null },
        data: { revokedAt: new Date(), revokedById: actor.id },
    });
    const row = await prisma.companyApiKey.findUniqueOrThrow({ where: { id: apiKeyId }, select: publicSelect });
    if (revoked.count) {
        await writeAuditLog({
            action: "API_KEY_REVOKED",
            userId: actor.id,
            companyId: row.companyId,
            entityType: "CompanyApiKey",
            entityId: row.id,
            details: { keyPrefix: row.keyPrefix },
        });
    }
    return serializeApiKey(row);
}

export type ApiKeyPrincipal = {
    apiKeyId: string;
    keyPrefix: string;
    scopes: ApiKeyScope[];
    companyId: string;
    /** The person the key acts as: its creator, still active and still a company admin. */
    actor: {
        id: string;
        email: string;
        name: string;
        role: UserRole;
        companyId: string;
        storeId: string | null;
    };
};

/** Every failure raises the same InvalidApiKeyError. */
export async function authenticateApiKey(rawKey: string, now = new Date()): Promise<ApiKeyPrincipal> {
    const prefix = apiKeyPrefixOf(rawKey);
    if (!prefix) throw new InvalidApiKeyError();
    const key = await prisma.companyApiKey.findUnique({
        where: { keyPrefix: prefix },
        select: {
            id: true,
            keyPrefix: true,
            keyHash: true,
            scopes: true,
            companyId: true,
            revokedAt: true,
            expiresAt: true,
            lastUsedAt: true,
            company: { select: { isActive: true } },
            createdBy: {
                select: {
                    id: true,
                    email: true,
                    name: true,
                    role: true,
                    isActive: true,
                    companyId: true,
                    storeId: true,
                    store: { select: { isActive: true, companyId: true } },
                },
            },
        },
    });
    if (!key || !apiKeyMatches(rawKey, key.keyHash, pepper())) throw new InvalidApiKeyError();
    const creator = key.createdBy;
    const usable = key.revokedAt === null
        && (key.expiresAt === null || key.expiresAt > now)
        && key.company.isActive
        && creator.isActive
        && creator.companyId === key.companyId
        && KEY_OWNER_ROLES.has(creator.role)
        && (!creator.storeId || (creator.store?.isActive === true && creator.store.companyId === key.companyId));
    if (!usable) throw new InvalidApiKeyError();

    if (!key.lastUsedAt || now.getTime() - key.lastUsedAt.getTime() > LAST_USED_RESOLUTION_MS) {
        await prisma.companyApiKey.update({ where: { id: key.id }, data: { lastUsedAt: now } });
    }
    return {
        apiKeyId: key.id,
        keyPrefix: key.keyPrefix,
        scopes: normalizeScopes(key.scopes),
        companyId: key.companyId,
        actor: {
            id: creator.id,
            email: creator.email,
            name: creator.name,
            role: creator.role,
            companyId: key.companyId,
            storeId: creator.storeId,
        },
    };
}

/**
 * Counts one request in the key's current minute (shared across instances).
 * Returns the seconds to wait when over the limit, or null.
 */
export async function consumeApiRateLimit(
    apiKeyId: string,
    now = new Date(),
    limit = API_RATE_LIMIT_PER_MINUTE,
): Promise<number | null> {
    const windowStart = new Date(Math.floor(now.getTime() / 60_000) * 60_000);
    // Prisma stores timestamp(3) in UTC; a raw Date parameter would be cast with
    // the session time zone, so the window is pinned to UTC explicitly.
    const [{ count }] = await prisma.$queryRaw<{ count: number }[]>`
        INSERT INTO "ApiRateWindow" ("apiKeyId", "windowStart", "count")
        VALUES (${apiKeyId}, (${windowStart.toISOString()}::timestamptz AT TIME ZONE 'UTC'), 1)
        ON CONFLICT ("apiKeyId", "windowStart")
        DO UPDATE SET "count" = "ApiRateWindow"."count" + 1
        RETURNING "count"`;
    if (count === 1) {
        // First request of a minute: drop this key's old windows.
        await prisma.apiRateWindow.deleteMany({
            where: { apiKeyId, windowStart: { lt: new Date(windowStart.getTime() - 3_600_000) } },
        });
    }
    if (count <= limit) return null;
    return Math.max(1, Math.ceil((windowStart.getTime() + 60_000 - now.getTime()) / 1000));
}
