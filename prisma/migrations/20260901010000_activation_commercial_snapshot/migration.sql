-- Freeze the commercial value used for both the Django Order and wallet debit.
-- Nullable columns preserve activation jobs created before this cutover.
ALTER TABLE "ActivationJob"
    ADD COLUMN "commercialAmount" DOUBLE PRECISION,
    ADD COLUMN "commercialCurrency" TEXT;
