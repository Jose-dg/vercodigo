-- API keys por empresa para la API v1. Solo se guarda el HMAC de la key.
-- SANDBOX (vck_test_) simula entregas sin cobrar, sin Diem y sin emails.
CREATE TYPE "ApiKeyEnvironment" AS ENUM ('LIVE', 'SANDBOX');

CREATE TABLE "CompanyApiKey" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "environment" "ApiKeyEnvironment" NOT NULL DEFAULT 'LIVE',
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

-- Entregas simuladas de keys sandbox: tabla aparte, nunca tocan billetera ni Diem.
CREATE TABLE "SandboxDelivery" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "apiKeyId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "denominationId" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitAmount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "recipientFirstName" TEXT NOT NULL,
    "recipientLastName" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "emailDelivery" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "SandboxDelivery_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SandboxDelivery_quantity_range" CHECK ("quantity" BETWEEN 1 AND 100),
    CONSTRAINT "SandboxDelivery_email_delivery_known"
        CHECK ("emailDelivery" IS NULL OR "emailDelivery" IN ('sending', 'sent', 'failed'))
);

CREATE UNIQUE INDEX "CompanyApiKey_keyPrefix_key" ON "CompanyApiKey"("keyPrefix");
CREATE INDEX "CompanyApiKey_companyId_environment_revokedAt_idx" ON "CompanyApiKey"("companyId", "environment", "revokedAt");
CREATE UNIQUE INDEX "SandboxDelivery_companyId_idempotencyKey_key" ON "SandboxDelivery"("companyId", "idempotencyKey");
CREATE INDEX "SandboxDelivery_apiKeyId_idx" ON "SandboxDelivery"("apiKeyId");

ALTER TABLE "CompanyApiKey" ADD CONSTRAINT "CompanyApiKey_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompanyApiKey" ADD CONSTRAINT "CompanyApiKey_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompanyApiKey" ADD CONSTRAINT "CompanyApiKey_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApiRateWindow" ADD CONSTRAINT "ApiRateWindow_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "CompanyApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SandboxDelivery" ADD CONSTRAINT "SandboxDelivery_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SandboxDelivery" ADD CONSTRAINT "SandboxDelivery_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "CompanyApiKey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
