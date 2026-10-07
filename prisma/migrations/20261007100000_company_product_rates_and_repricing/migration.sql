CREATE TYPE "SalePriceCorrectionStatus" AS ENUM (
    'PENDING',
    'REMOTE_APPLIED',
    'COMPLETED',
    'FAILED'
);

CREATE TABLE "CompanyProductRate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "rateCopPerUsd" DOUBLE PRECISION NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CompanyProductRate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanyProductRate_companyId_productId_key"
    ON "CompanyProductRate"("companyId", "productId");
CREATE INDEX "CompanyProductRate_productId_idx"
    ON "CompanyProductRate"("productId");

ALTER TABLE "CompanyProductRate"
    ADD CONSTRAINT "CompanyProductRate_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyProductRate"
    ADD CONSTRAINT "CompanyProductRate_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CodePurchase"
    ADD COLUMN "sourceAmount" DOUBLE PRECISION,
    ADD COLUMN "sourceCurrency" TEXT,
    ADD COLUMN "appliedExchangeRate" DOUBLE PRECISION,
    ADD COLUMN "billingUnitAmount" DOUBLE PRECISION;

ALTER TABLE "CardActivation"
    ADD COLUMN "commercialAmount" DOUBLE PRECISION,
    ADD COLUMN "commercialCurrency" TEXT,
    ADD COLUMN "sourceAmount" DOUBLE PRECISION,
    ADD COLUMN "sourceCurrency" TEXT,
    ADD COLUMN "appliedExchangeRate" DOUBLE PRECISION;

ALTER TABLE "ActivationJob"
    ADD COLUMN "sourceAmount" DOUBLE PRECISION,
    ADD COLUMN "sourceCurrency" TEXT,
    ADD COLUMN "appliedExchangeRate" DOUBLE PRECISION;

CREATE TABLE "SalePriceCorrection" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "walletTransactionId" TEXT NOT NULL,
    "diemRequestId" TEXT NOT NULL,
    "status" "SalePriceCorrectionStatus" NOT NULL DEFAULT 'PENDING',
    "fingerprint" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "oldRate" DOUBLE PRECISION NOT NULL,
    "newRate" DOUBLE PRECISION NOT NULL,
    "oldTotal" DOUBLE PRECISION NOT NULL,
    "newTotal" DOUBLE PRECISION NOT NULL,
    "actorId" TEXT NOT NULL,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "SalePriceCorrection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SalePriceCorrection_idempotencyKey_key"
    ON "SalePriceCorrection"("idempotencyKey");
CREATE INDEX "SalePriceCorrection_companyId_createdAt_idx"
    ON "SalePriceCorrection"("companyId", "createdAt");
CREATE INDEX "SalePriceCorrection_targetType_targetId_idx"
    ON "SalePriceCorrection"("targetType", "targetId");
CREATE INDEX "SalePriceCorrection_status_updatedAt_idx"
    ON "SalePriceCorrection"("status", "updatedAt");
