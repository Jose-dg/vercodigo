-- Generated from the Prisma schema after the audited duplicate-consumption
-- repair. PostgreSQL unique indexes allow multiple NULL values, so detached
-- audit rows remain valid while an active purchase can own only one movement.
DROP INDEX IF EXISTS "WalletTransaction_codePurchaseId_idx";
CREATE UNIQUE INDEX "WalletTransaction_codePurchaseId_key"
ON "WalletTransaction"("codePurchaseId");
