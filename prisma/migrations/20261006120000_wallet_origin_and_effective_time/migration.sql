ALTER TYPE "WalletTransactionType" ADD VALUE IF NOT EXISTS 'OPENING_BALANCE';

ALTER TABLE "User" ADD COLUMN "purchaseOriginPhoneId" TEXT;
ALTER TABLE "WalletTransaction" ADD COLUMN "occurredAt" TIMESTAMP(3);
ALTER TABLE "WalletTransaction" ADD COLUMN "occurredSequence" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CodePurchase" ADD COLUMN "occurredAt" TIMESTAMP(3);
ALTER TABLE "CodePurchase" ADD COLUMN "occurredSequence" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CodePurchase" ADD COLUMN "purchaseOriginPhoneId" TEXT;
ALTER TABLE "CodePurchase" ADD COLUMN "originLabelSnapshot" TEXT;

UPDATE "WalletTransaction" SET "occurredAt" = "createdAt" WHERE "occurredAt" IS NULL;
UPDATE "CodePurchase" SET "occurredAt" = "createdAt" WHERE "occurredAt" IS NULL;

ALTER TABLE "WalletTransaction" ALTER COLUMN "occurredAt" SET NOT NULL;
ALTER TABLE "WalletTransaction" ALTER COLUMN "occurredAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "CodePurchase" ALTER COLUMN "occurredAt" SET NOT NULL;
ALTER TABLE "CodePurchase" ALTER COLUMN "occurredAt" SET DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "PurchaseOriginPhone" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "storeId" TEXT,
    "phone" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PurchaseOriginPhone_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PurchaseOriginPhone_companyId_phone_key" ON "PurchaseOriginPhone"("companyId", "phone");
CREATE INDEX "PurchaseOriginPhone_storeId_idx" ON "PurchaseOriginPhone"("storeId");
CREATE INDEX "User_purchaseOriginPhoneId_idx" ON "User"("purchaseOriginPhoneId");
CREATE INDEX "WalletTransaction_walletId_occurredAt_occurredSequence_id_idx" ON "WalletTransaction"("walletId", "occurredAt", "occurredSequence", "id");
CREATE INDEX "CodePurchase_occurredAt_occurredSequence_id_idx" ON "CodePurchase"("occurredAt", "occurredSequence", "id");
CREATE INDEX "CodePurchase_purchaseOriginPhoneId_idx" ON "CodePurchase"("purchaseOriginPhoneId");

ALTER TABLE "PurchaseOriginPhone" ADD CONSTRAINT "PurchaseOriginPhone_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseOriginPhone" ADD CONSTRAINT "PurchaseOriginPhone_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_purchaseOriginPhoneId_fkey" FOREIGN KEY ("purchaseOriginPhoneId") REFERENCES "PurchaseOriginPhone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CodePurchase" ADD CONSTRAINT "CodePurchase_purchaseOriginPhoneId_fkey" FOREIGN KEY ("purchaseOriginPhoneId") REFERENCES "PurchaseOriginPhone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
