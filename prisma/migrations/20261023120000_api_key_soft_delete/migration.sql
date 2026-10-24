-- Una key eliminada deja de ser visible y válida, pero conserva sus entregas
-- sandbox y la trazabilidad de auditoría.
ALTER TABLE "CompanyApiKey"
    ADD COLUMN "deletedAt" TIMESTAMP(3),
    ADD COLUMN "deletedById" TEXT;

ALTER TABLE "CompanyApiKey"
    ADD CONSTRAINT "CompanyApiKey_deletion_consistent"
        CHECK (("deletedAt" IS NULL) = ("deletedById" IS NULL));

ALTER TABLE "CompanyApiKey"
    ADD CONSTRAINT "CompanyApiKey_deleted_is_revoked"
        CHECK ("deletedAt" IS NULL OR "revokedAt" IS NOT NULL);

ALTER TABLE "CompanyApiKey"
    ADD CONSTRAINT "CompanyApiKey_deletedById_fkey"
        FOREIGN KEY ("deletedById") REFERENCES "User"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "CompanyApiKey_visible_company_environment_idx"
    ON "CompanyApiKey"("companyId", "environment", "createdAt" DESC)
    WHERE "deletedAt" IS NULL;

-- Keyset pagination for the new public order list endpoints.
CREATE INDEX "SandboxDelivery_companyId_createdAt_id_idx"
    ON "SandboxDelivery"("companyId", "createdAt", "id");
CREATE INDEX "CodePurchase_companyId_occurredAt_occurredSequence_id_idx"
    ON "CodePurchase"("companyId", "occurredAt", "occurredSequence", "id");
