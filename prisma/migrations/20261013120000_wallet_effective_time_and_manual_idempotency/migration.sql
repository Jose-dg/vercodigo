-- Effective time of wallet movements: occurredAt keeps its value, its origin
-- becomes explicit. Manual top-ups gain idempotency and a unique bank reference.

CREATE TYPE "WalletTimeSource" AS ENUM (
    'LEDGER_EVENT', 'PAYMENT', 'GATEWAY_CONFIRMATION', 'SOURCE_SYSTEM', 'REGISTRATION_ONLY'
);

ALTER TABLE "WalletTransaction" ADD COLUMN "occurredAtSource" "WalletTimeSource";
ALTER TABLE "WalletTransaction" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "WalletTransaction" ADD COLUMN "requestFingerprint" TEXT;

-- Deterministic backfill. occurredAt is never rewritten.
--  * bp-hist-*: imported from Blue Panther with the source system's time.
--  * Other top-ups stamped more than a minute away from their registration:
--    an audited correction set the payment time explicitly
--    (repair-virtual-zone-ledger). The application used to stamp occurredAt
--    with its own clock, milliseconds apart from createdAt; that is still the
--    registration time.
--  * Remaining top-ups: no payment time is known; occurredAt is the
--    registration time and is now declared as such.
--  * Everything else was produced by the ledger at that moment.
UPDATE "WalletTransaction" SET "occurredAtSource" = CASE
    WHEN "id" LIKE 'bp-hist-%' THEN 'SOURCE_SYSTEM'::"WalletTimeSource"
    WHEN "type" = 'RECHARGE'
        AND abs(extract(epoch FROM "occurredAt" - "createdAt")) > 60 THEN 'PAYMENT'::"WalletTimeSource"
    WHEN "type" = 'RECHARGE' THEN 'REGISTRATION_ONLY'::"WalletTimeSource"
    ELSE 'LEDGER_EVENT'::"WalletTimeSource"
END
WHERE "occurredAtSource" IS NULL;

ALTER TABLE "WalletTransaction" ALTER COLUMN "occurredAtSource" SET NOT NULL;

ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_registration_only_is_honest"
    CHECK ("occurredAtSource" <> 'REGISTRATION_ONLY'
        OR ("type" = 'RECHARGE' AND abs(extract(epoch FROM "occurredAt" - "createdAt")) <= 60));
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_gateway_confirmation_has_topup"
    CHECK ("occurredAtSource" <> 'GATEWAY_CONFIRMATION' OR "gatewayTransactionId" IS NOT NULL);
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_idempotency_has_fingerprint"
    CHECK (("idempotencyKey" IS NULL) = ("requestFingerprint" IS NULL));

CREATE UNIQUE INDEX "WalletTransaction_idempotencyKey_key" ON "WalletTransaction"("idempotencyKey");

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM "WalletTransaction"
        WHERE "type" = 'RECHARGE' AND "method" = 'MANUAL' AND "externalReference" IS NOT NULL
        GROUP BY "walletId", "externalReference" HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'Duplicate manual top-up references per wallet: resolve them before migrating';
    END IF;
END $$;

-- One bank transfer credits a wallet once.
CREATE UNIQUE INDEX "WalletTransaction_manual_recharge_reference_key"
    ON "WalletTransaction"("walletId", "externalReference")
    WHERE "type" = 'RECHARGE' AND "method" = 'MANUAL' AND "externalReference" IS NOT NULL;

-- Snapshot of the time source on statement lines (ADD COLUMN does not fire
-- the immutability trigger; lines issued earlier keep NULL = not captured).
ALTER TABLE "AccountStatementLine" ADD COLUMN "occurredAtSource" "WalletTimeSource";
