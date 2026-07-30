-- Prepared for controlled deployment. Do not run automatically against production.
ALTER TABLE "Product" ADD COLUMN "devDiemProductId" TEXT;
ALTER TABLE "ProductDenomination" ADD COLUMN "devDiemProductId" TEXT;

ALTER TABLE "CodePurchase"
    ALTER COLUMN "status" SET DEFAULT 'PENDING',
    ADD COLUMN "idempotencyKey" TEXT,
    ADD COLUMN "diemRequestId" TEXT,
    ADD COLUMN "fulfillmentStatus" TEXT,
    ADD COLUMN "deliveredCodes" JSONB,
    ADD COLUMN "lastError" TEXT,
    ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "nextRetryAt" TIMESTAMP(3),
    ADD COLUMN "completedAt" TIMESTAMP(3);

-- Existing purchases receive stable historical keys before the NOT NULL gate.
UPDATE "CodePurchase"
SET "idempotencyKey" = 'legacy-code-purchase:' || "id"
WHERE "idempotencyKey" IS NULL;
ALTER TABLE "CodePurchase" ALTER COLUMN "idempotencyKey" SET NOT NULL;

ALTER TABLE "ActivationJob"
    ADD COLUMN "idempotencyKey" TEXT,
    ADD COLUMN "diemRequestId" TEXT,
    ADD COLUMN "fulfillmentStatus" TEXT,
    ADD COLUMN "deliveredCodes" JSONB,
    ADD COLUMN "nextRetryAt" TIMESTAMP(3);

UPDATE "ActivationJob"
SET "idempotencyKey" = 'legacy-activation-job:' || "id"
WHERE "idempotencyKey" IS NULL;
ALTER TABLE "ActivationJob" ALTER COLUMN "idempotencyKey" SET NOT NULL;

CREATE UNIQUE INDEX "Product_devDiemProductId_key" ON "Product"("devDiemProductId");
CREATE UNIQUE INDEX "ProductDenomination_devDiemProductId_key" ON "ProductDenomination"("devDiemProductId");
CREATE UNIQUE INDEX "CodePurchase_idempotencyKey_key" ON "CodePurchase"("idempotencyKey");
CREATE UNIQUE INDEX "CodePurchase_diemRequestId_key" ON "CodePurchase"("diemRequestId");
CREATE INDEX "CodePurchase_status_nextRetryAt_idx" ON "CodePurchase"("status", "nextRetryAt");
CREATE UNIQUE INDEX "ActivationJob_idempotencyKey_key" ON "ActivationJob"("idempotencyKey");
CREATE UNIQUE INDEX "ActivationJob_diemRequestId_key" ON "ActivationJob"("diemRequestId");
CREATE INDEX "ActivationJob_status_nextRetryAt_idx" ON "ActivationJob"("status", "nextRetryAt");
