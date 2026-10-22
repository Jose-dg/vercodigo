-- API keys por empresa para la API v1. Solo se guarda el HMAC de la key.
CREATE TABLE "CompanyApiKey" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "scopes" TEXT[],
    "createdById" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyApiKey_pkey" PRIMARY KEY ("id"),
    -- Una key revocada siempre sabe quién la revocó, y una activa no tiene revocador.
    CONSTRAINT "CompanyApiKey_revocation_consistent"
        CHECK (("revokedAt" IS NULL) = ("revokedById" IS NULL)),
    CONSTRAINT "CompanyApiKey_has_scopes" CHECK (cardinality("scopes") > 0)
);

CREATE TABLE "ApiRateWindow" (
    "apiKeyId" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ApiRateWindow_pkey" PRIMARY KEY ("apiKeyId","windowStart")
);

CREATE UNIQUE INDEX "CompanyApiKey_keyPrefix_key" ON "CompanyApiKey"("keyPrefix");
CREATE INDEX "CompanyApiKey_companyId_revokedAt_idx" ON "CompanyApiKey"("companyId", "revokedAt");

ALTER TABLE "CompanyApiKey" ADD CONSTRAINT "CompanyApiKey_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompanyApiKey" ADD CONSTRAINT "CompanyApiKey_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompanyApiKey" ADD CONSTRAINT "CompanyApiKey_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApiRateWindow" ADD CONSTRAINT "ApiRateWindow_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "CompanyApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
