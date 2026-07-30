-- AlterTable
ALTER TABLE "CodePurchase" ADD COLUMN     "denominationId" TEXT;

-- CreateTable
CREATE TABLE "CompanyProductPrice" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "denominationId" TEXT,
    "salePrice" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'COP',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyProductPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyProductPrice_companyId_idx" ON "CompanyProductPrice"("companyId");

-- CreateIndex
CREATE INDEX "CompanyProductPrice_productId_idx" ON "CompanyProductPrice"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyProductPrice_companyId_productId_denominationId_key" ON "CompanyProductPrice"("companyId", "productId", "denominationId");

-- CreateIndex
CREATE INDEX "CodePurchase_denominationId_idx" ON "CodePurchase"("denominationId");

-- AddForeignKey
ALTER TABLE "CompanyProductPrice" ADD CONSTRAINT "CompanyProductPrice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyProductPrice" ADD CONSTRAINT "CompanyProductPrice_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyProductPrice" ADD CONSTRAINT "CompanyProductPrice_denominationId_fkey" FOREIGN KEY ("denominationId") REFERENCES "ProductDenomination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodePurchase" ADD CONSTRAINT "CodePurchase_denominationId_fkey" FOREIGN KEY ("denominationId") REFERENCES "ProductDenomination"("id") ON DELETE SET NULL ON UPDATE CASCADE;

