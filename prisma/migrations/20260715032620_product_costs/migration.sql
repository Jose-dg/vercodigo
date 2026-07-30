-- CreateTable
CREATE TABLE "ProductCost" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "productId" TEXT NOT NULL,
    "denominationId" TEXT,
    "cost" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'COP',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductCost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductCost_productId_idx" ON "ProductCost"("productId");

-- CreateIndex
CREATE INDEX "ProductCost_companyId_idx" ON "ProductCost"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCost_companyId_productId_denominationId_key" ON "ProductCost"("companyId", "productId", "denominationId");

-- AddForeignKey
ALTER TABLE "ProductCost" ADD CONSTRAINT "ProductCost_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCost" ADD CONSTRAINT "ProductCost_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCost" ADD CONSTRAINT "ProductCost_denominationId_fkey" FOREIGN KEY ("denominationId") REFERENCES "ProductDenomination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

