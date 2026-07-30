-- CreateEnum
CREATE TYPE "KeyStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'SOLD');

-- CreateEnum
CREATE TYPE "ActivationBillingStatus" AS ENUM ('PENDING', 'INVOICED', 'PAID', 'CANCELLED');

-- AlterTable
ALTER TABLE "Card" DROP COLUMN "pin",
DROP COLUMN "transactionId",
ADD COLUMN     "activationAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "activationLock" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "activationLockAt" TIMESTAMP(3),
ADD COLUMN     "activationLockBy" TEXT,
ADD COLUMN     "batchId" TEXT,
ADD COLUMN     "fabricationUnitCost" DOUBLE PRECISION,
ADD COLUMN     "keyId" TEXT,
ADD COLUMN     "lastActivationAttempt" TIMESTAMP(3),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "CardActivation" ADD COLUMN     "activationAmount" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "billingStatus" "ActivationBillingStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "commissionAmount" DOUBLE PRECISION,
ADD COLUMN     "commissionRateApplied" DOUBLE PRECISION,
ADD COLUMN     "grossProfit" DOUBLE PRECISION,
ADD COLUMN     "invoiceId" TEXT,
ADD COLUMN     "otherCosts" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "exchangeRate" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "InvoiceItem" ADD COLUMN     "cardId" TEXT,
ADD COLUMN     "storeId" TEXT;

-- CreateTable
CREATE TABLE "CardBatch" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "manufacturer" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'COP',
    "totalCards" INTEGER NOT NULL,
    "totalCost" DOUBLE PRECISION NOT NULL,
    "producedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Key" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "transactionId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" "KeyStatus" NOT NULL DEFAULT 'AVAILABLE',
    "purchaseId" TEXT,

    CONSTRAINT "Key_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodePurchase" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "storeId" TEXT,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodePurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivationAttempt" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "companyId" TEXT,
    "success" BOOLEAN NOT NULL,
    "failureReason" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "deviceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivationAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storeId" TEXT,
    "action" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimitLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT,
    "storeId" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "deviceId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "details" JSONB,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivationJob" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "userId" TEXT,
    "storeId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivationJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CardBatch_code_key" ON "CardBatch"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Key_code_key" ON "Key"("code");

-- CreateIndex
CREATE INDEX "Key_productId_idx" ON "Key"("productId");

-- CreateIndex
CREATE INDEX "Key_status_idx" ON "Key"("status");

-- CreateIndex
CREATE INDEX "Key_purchaseId_idx" ON "Key"("purchaseId");

-- CreateIndex
CREATE INDEX "CodePurchase_companyId_idx" ON "CodePurchase"("companyId");

-- CreateIndex
CREATE INDEX "CodePurchase_storeId_idx" ON "CodePurchase"("storeId");

-- CreateIndex
CREATE INDEX "CodePurchase_userId_idx" ON "CodePurchase"("userId");

-- CreateIndex
CREATE INDEX "CodePurchase_createdAt_idx" ON "CodePurchase"("createdAt");

-- CreateIndex
CREATE INDEX "ActivationAttempt_cardId_idx" ON "ActivationAttempt"("cardId");

-- CreateIndex
CREATE INDEX "ActivationAttempt_userId_createdAt_idx" ON "ActivationAttempt"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivationAttempt_storeId_idx" ON "ActivationAttempt"("storeId");

-- CreateIndex
CREATE INDEX "RateLimitLog_userId_action_windowStart_idx" ON "RateLimitLog"("userId", "action", "windowStart");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimitLog_userId_action_windowStart_key" ON "RateLimitLog"("userId", "action", "windowStart");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "ActivationJob_status_attempts_idx" ON "ActivationJob"("status", "attempts");

-- CreateIndex
CREATE INDEX "ActivationJob_cardId_idx" ON "ActivationJob"("cardId");

-- CreateIndex
CREATE INDEX "ActivationJob_createdAt_idx" ON "ActivationJob"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Card_keyId_key" ON "Card"("keyId");

-- CreateIndex
CREATE INDEX "Card_batchId_idx" ON "Card"("batchId");

-- CreateIndex
CREATE INDEX "Card_keyId_idx" ON "Card"("keyId");

-- CreateIndex
CREATE INDEX "Card_activationLock_idx" ON "Card"("activationLock");

-- CreateIndex
CREATE INDEX "Card_isActivated_storeId_productId_idx" ON "Card"("isActivated", "storeId", "productId");

-- CreateIndex
CREATE INDEX "CardActivation_billingStatus_idx" ON "CardActivation"("billingStatus");

-- CreateIndex
CREATE INDEX "CardActivation_invoiceId_idx" ON "CardActivation"("invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceItem_storeId_idx" ON "InvoiceItem"("storeId");

-- CreateIndex
CREATE INDEX "InvoiceItem_cardId_idx" ON "InvoiceItem"("cardId");

-- AddForeignKey
ALTER TABLE "Key" ADD CONSTRAINT "Key_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Key" ADD CONSTRAINT "Key_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "CodePurchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "CardBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_keyId_fkey" FOREIGN KEY ("keyId") REFERENCES "Key"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardActivation" ADD CONSTRAINT "CardActivation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivationAttempt" ADD CONSTRAINT "ActivationAttempt_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivationJob" ADD CONSTRAINT "ActivationJob_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

