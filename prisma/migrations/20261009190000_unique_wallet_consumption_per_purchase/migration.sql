-- Generated from the Prisma schema after the audited duplicate-consumption
-- repair. PostgreSQL unique indexes allow multiple NULL values, so detached
-- audit rows remain valid while an active purchase can own only one movement.
-- IF NOT EXISTS: production received this index before the migration was
-- recorded, so the deploy must converge instead of failing on it.
DROP INDEX IF EXISTS "WalletTransaction_codePurchaseId_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "WalletTransaction_codePurchaseId_key"
ON "WalletTransaction"("codePurchaseId");
