-- Top-ups collected and verified by DevDiem (Bre-B) are credited here once.
-- gatewayTransactionId holds the DevDiem top-up id; the unique index makes a
-- replayed sync unable to credit the same top-up twice. Additive.
ALTER TYPE "WalletRechargeMethod" ADD VALUE IF NOT EXISTS 'BRE_B';
CREATE UNIQUE INDEX IF NOT EXISTS "WalletTransaction_gatewayTransactionId_key"
ON "WalletTransaction"("gatewayTransactionId");
