CREATE TYPE "WalletReversalPresentation" AS ENUM (
    'SHOW_REVERSAL',
    'OMIT_NEUTRALIZED_PAIR'
);

ALTER TABLE "WalletTransaction"
ADD COLUMN "reversalPresentation" "WalletReversalPresentation" NOT NULL DEFAULT 'SHOW_REVERSAL';

ALTER TABLE "CodePurchase"
ADD COLUMN "lastRemoteCheckAt" TIMESTAMP(3);

CREATE INDEX "CodePurchase_status_lastRemoteCheckAt_idx"
ON "CodePurchase"("status", "lastRemoteCheckAt");

ALTER TABLE "WalletTransaction"
ADD CONSTRAINT "WalletTransaction_reversal_presentation_refund_only"
CHECK (
    "reversalPresentation" = 'SHOW_REVERSAL'
    OR ("type" = 'REFUND' AND "reversalOfId" IS NOT NULL)
);
