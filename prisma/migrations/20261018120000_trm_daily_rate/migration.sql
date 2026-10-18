-- Precio de productos de región USA a partir de la TRM oficial del día.
--  * TrmRate: TRM de Superfinanciera por período de vigencia (fines de semana y
--    festivos comparten la del día hábil anterior). Se llena bajo demanda.
--  * ProductDenomination.countryRegion: región del catálogo de Diem; se sincroniza
--    al consultar el catálogo. Nula hasta la primera sincronización: mientras tanto
--    la denominación conserva su costo configurado.

CREATE TABLE "TrmRate" (
    "id" TEXT NOT NULL,
    "validFrom" DATE NOT NULL,
    "validTo" DATE NOT NULL,
    "valueCop" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrmRate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrmRate_validFrom_key" ON "TrmRate"("validFrom");
CREATE INDEX "TrmRate_validTo_idx" ON "TrmRate"("validTo");

ALTER TABLE "ProductDenomination" ADD COLUMN "countryRegion" TEXT;
