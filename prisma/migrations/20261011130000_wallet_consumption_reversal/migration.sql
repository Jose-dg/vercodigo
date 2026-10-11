-- A REFUND movement reverses exactly one CONSUMPTION when Diem cancels a
-- delivery after it was billed. The unique index makes a second reversal of
-- the same movement impossible (e.g. a replayed webhook). Additive, nullable.
ALTER TABLE "WalletTransaction" ADD COLUMN IF NOT EXISTS "reversalOfId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "WalletTransaction_reversalOfId_key"
ON "WalletTransaction"("reversalOfId");
ALTER TABLE "WalletTransaction"
ADD CONSTRAINT "WalletTransaction_reversalOfId_fkey"
FOREIGN KEY ("reversalOfId") REFERENCES "WalletTransaction"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
