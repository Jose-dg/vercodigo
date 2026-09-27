-- Account statements are immutable snapshots of confirmed wallet movements.
-- They are deliberately separate from the fiscal/commission Invoice model.
CREATE TABLE "AccountStatement" (
    "id" TEXT NOT NULL,
    "statementNumber" TEXT NOT NULL,
    "sequenceYear" INTEGER NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "companyId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "issuedById" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "openingBalance" DECIMAL(18,2) NOT NULL,
    "consumptions" DECIMAL(18,2) NOT NULL,
    "recharges" DECIMAL(18,2) NOT NULL,
    "refunds" DECIMAL(18,2) NOT NULL,
    "adjustments" DECIMAL(18,2) NOT NULL,
    "closingBalance" DECIMAL(18,2) NOT NULL,
    "totalPending" DECIMAL(18,2) NOT NULL,
    "creditBalance" DECIMAL(18,2) NOT NULL,
    "issuerSnapshot" JSONB NOT NULL,
    "customerSnapshot" JSONB NOT NULL,
    "previewFingerprint" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountStatement_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AccountStatement_period_valid" CHECK ("periodEnd" >= "periodStart"),
    CONSTRAINT "AccountStatement_currency_valid" CHECK (char_length("currency") = 3),
    CONSTRAINT "AccountStatement_totals_nonnegative" CHECK (
        "consumptions" >= 0 AND "recharges" >= 0 AND "refunds" >= 0
        AND "totalPending" >= 0 AND "creditBalance" >= 0
    ),
    CONSTRAINT "AccountStatement_single_closing_position" CHECK (
        "totalPending" = 0 OR "creditBalance" = 0
    )
);

CREATE TABLE "AccountStatementLine" (
    "id" TEXT NOT NULL,
    "accountStatementId" TEXT NOT NULL,
    "walletTransactionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "type" "WalletTransactionType" NOT NULL,
    "description" TEXT NOT NULL,
    "productDetail" TEXT,
    "quantity" INTEGER,
    "unitPrice" DECIMAL(18,2),
    "debit" DECIMAL(18,2) NOT NULL,
    "credit" DECIMAL(18,2) NOT NULL,
    "balanceAfter" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "AccountStatementLine_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AccountStatementLine_amounts_nonnegative" CHECK ("debit" >= 0 AND "credit" >= 0),
    CONSTRAINT "AccountStatementLine_single_direction" CHECK ("debit" = 0 OR "credit" = 0),
    CONSTRAINT "AccountStatementLine_position_positive" CHECK ("position" > 0),
    CONSTRAINT "AccountStatementLine_quantity_positive" CHECK ("quantity" IS NULL OR "quantity" > 0)
);

CREATE UNIQUE INDEX "AccountStatement_statementNumber_key" ON "AccountStatement"("statementNumber");
CREATE UNIQUE INDEX "AccountStatement_sequenceYear_sequenceNumber_key" ON "AccountStatement"("sequenceYear", "sequenceNumber");
CREATE INDEX "AccountStatement_companyId_issuedAt_idx" ON "AccountStatement"("companyId", "issuedAt");
CREATE INDEX "AccountStatement_walletId_periodEnd_idx" ON "AccountStatement"("walletId", "periodEnd");
CREATE INDEX "AccountStatement_issuedById_idx" ON "AccountStatement"("issuedById");

CREATE UNIQUE INDEX "AccountStatementLine_walletTransactionId_key" ON "AccountStatementLine"("walletTransactionId");
CREATE UNIQUE INDEX "AccountStatementLine_accountStatementId_position_key" ON "AccountStatementLine"("accountStatementId", "position");
CREATE INDEX "AccountStatementLine_accountStatementId_occurredAt_idx" ON "AccountStatementLine"("accountStatementId", "occurredAt");

ALTER TABLE "AccountStatement"
    ADD CONSTRAINT "AccountStatement_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AccountStatement"
    ADD CONSTRAINT "AccountStatement_walletId_fkey"
    FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AccountStatement"
    ADD CONSTRAINT "AccountStatement_issuedById_fkey"
    FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AccountStatementLine"
    ADD CONSTRAINT "AccountStatementLine_accountStatementId_fkey"
    FOREIGN KEY ("accountStatementId") REFERENCES "AccountStatement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AccountStatementLine"
    ADD CONSTRAINT "AccountStatementLine_walletTransactionId_fkey"
    FOREIGN KEY ("walletTransactionId") REFERENCES "WalletTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Emitted statements are evidence. Corrections are represented by later ledger
-- movements and a new statement, never by rewriting an issued snapshot.
CREATE FUNCTION "prevent_account_statement_mutation"() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'issued account statements are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AccountStatement_immutable"
    BEFORE UPDATE OR DELETE ON "AccountStatement"
    FOR EACH ROW EXECUTE FUNCTION "prevent_account_statement_mutation"();

CREATE TRIGGER "AccountStatementLine_immutable"
    BEFORE UPDATE OR DELETE ON "AccountStatementLine"
    FOR EACH ROW EXECUTE FUNCTION "prevent_account_statement_mutation"();
