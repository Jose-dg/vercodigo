# Precio de productos USA por TRM del día (oct 2026)

## Problema
Cada día había que decidir a mano a qué tasa se les vendía a los mayoristas los productos de región USA. En producción no había tasas por empresa (`CompanyProductRate` vacío) ni `FX_USD_COP`: el precio salía de costos globales fijos en COP (≈ 3.600 COP/USD).

## Regla nueva
- **Tasa mayorista** = TRM oficial redondeada **hacia abajo a la decena** + **margen** de plataforma.
  - Ejemplo: TRM 3.174,67 → 3.170; con margen 0 → 3.170 COP/USD; US$10 = 31.700.
- Aplica a **denominaciones USD de región USA** (`countryRegion = "united_states"`) en wallets COP. Colombia y los productos COP conservan su costo configurado.
- Reemplaza las tasas manuales por empresa: la pestaña "Precio actual" de `/costs` ya no las edita, `/api/billing-rates` se retiró y `CompanyProductRate` queda obsoleto (se elimina en una migración posterior, cuando se confirme sin filas).
- **A futuro**, el descuento de cada compañía (hoy `commissionRate`) se restará en `wholesaleRateFromTrm` (`src/lib/pricing/trm.ts`).

## Cómo se obtiene la TRM (sin cron ni workers)
- **Fuente:** API oficial de Superfinanciera en datos.gov.co (`resource/32sa-8pi3.json`, Socrata, sin API key). No es scraping.
- **Bajo demanda:**
  - La primera cotización que no encuentra la TRM vigente para hoy (hora de Bogotá) la consulta (timeout 4 s) y la guarda en `TrmRate`; el resto del día se lee de la base.
  - Fines de semana y festivos usan la vigencia que publica Superfinanciera (p. ej. la del viernes rige hasta el lunes).
  - Dos consultas simultáneas no chocan: upsert por `validFrom`.
- **Dentro de una transacción** (débito de la compra) nunca se llama a la API: solo se lee la base. La cotización previa ya la trajo.
- **Si la API falla:**
  - No se reintenta durante 1 minuto.
  - Se usa la última TRM guardada, hasta 7 días; en `/costs` se avisa que está desactualizada.
  - Sin TRM utilizable se cobra el costo configurado.
- **Cambio de día:** si la TRM cambia entre la cotización y la compra, la validación existente responde "La tarifa cambió…" y el cliente confirma de nuevo.

## Región
`ProductDenomination.countryRegion` se sincroniza desde el catálogo de Diem cada vez que se carga la compra (`/api/products?purchasable=true`). Solo escribe cambios y nunca borra por ausencia.

## Pantalla
`/costs` → "Precio actual":
- TRM oficial y su vigencia, la TRM redondeada, el margen (editable por plataforma) y la tasa mayorista.
- La lista de precios de hoy de cada producto USA. Plataforma la ve junto al costo configurado de respaldo.

## Despliegue
1. `prisma migrate deploy` (migración `20261018120000_trm_daily_rate`: tabla `TrmRate` + columna `countryRegion`).
2. **Antes o justo después del deploy, definir el margen**: con margen 0 los productos USA bajan de ~3.600 a la TRM redondeada (≈ −12 % hoy). Se ajusta en `/costs` o con:
   `INSERT INTO "SystemConfig"(id, key, value, "updatedAt") VALUES ('trm-spread', 'TRM_SPREAD_COP', '<pesos>', now()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, "updatedAt" = now();`
3. Abrir `/codes/purchase` una vez para sincronizar las regiones (hasta entonces los productos USA conservan su costo configurado).

## Verificación
- Tests `test:purchase-quote` (18, incluye `tests/trm.test.mjs`) y demás suites en verde; `next build` compila.
- Consulta real a la API con el código del repo: 18-oct-2026 → TRM 3.174,67 (vigente 17–19 oct) → tasa 3.170.

## Corrección de datos hecha en producción
- `ProductCost` de **PSN US$50 — Colombia**: 20.000 → **200.000 COP** (18-oct-2026, 10:11), alineado a 4.000/USD como las demás denominaciones Colombia.
- No hubo ventas a 20.000: las 5 compras de esa denominación son anteriores a la configuración del 7-oct.
