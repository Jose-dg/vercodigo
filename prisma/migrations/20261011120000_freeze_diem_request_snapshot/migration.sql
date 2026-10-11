-- Exact Diem code-request command, frozen on the first attempt so retries
-- resend the same payload behind the same Idempotency-Key. Additive, nullable.
ALTER TABLE "CodePurchase" ADD COLUMN IF NOT EXISTS "diemRequestSnapshot" JSONB;
ALTER TABLE "ActivationJob" ADD COLUMN IF NOT EXISTS "diemRequestSnapshot" JSONB;
