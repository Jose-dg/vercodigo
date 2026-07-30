-- Roles: COMPANY_ADMIN -> OWNER (same scope today: whole company, all stores),
-- STORE_OPERATOR -> OPERATOR (plain rename), plus new GENERAL_ADMIN and ADMIN values.
CREATE TYPE "UserRole_new" AS ENUM ('SUPER_ADMIN', 'SYSTEM_ADMIN', 'OWNER', 'GENERAL_ADMIN', 'ADMIN', 'OPERATOR');

ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new" USING (
  CASE "role"::text
    WHEN 'COMPANY_ADMIN' THEN 'OWNER'
    WHEN 'STORE_OPERATOR' THEN 'OPERATOR'
    ELSE "role"::text
  END
)::"UserRole_new";

DROP TYPE "UserRole";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";

-- AuthorizedPhone: rescope to Company (a number can be company-wide or narrowed to one store).
ALTER TABLE "AuthorizedPhone" ADD COLUMN "companyId" TEXT;

UPDATE "AuthorizedPhone" ap
SET "companyId" = s."companyId"
FROM "Store" s
WHERE ap."storeId" = s."id";

ALTER TABLE "AuthorizedPhone" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "AuthorizedPhone" ALTER COLUMN "storeId" DROP NOT NULL;

DROP INDEX "AuthorizedPhone_phone_storeId_key";
CREATE UNIQUE INDEX "AuthorizedPhone_phone_companyId_storeId_key" ON "AuthorizedPhone"("phone", "companyId", "storeId");
CREATE INDEX "AuthorizedPhone_companyId_idx" ON "AuthorizedPhone"("companyId");

ALTER TABLE "AuthorizedPhone" ADD CONSTRAINT "AuthorizedPhone_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
