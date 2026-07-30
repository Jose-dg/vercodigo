# Roadmap: Plataforma Multi-tenant + Wallet

Resumen de las decisiones y fases acordadas para evolucionar Diem SAS de un gestor de tiendas con facturación por comisión a una plataforma multi-tenant con wallet prepago por compañía. Este documento es la referencia viva del roadmap; cada fase se implementa y valida por separado.

## Modelo de roles

Roles de plataforma (Diem SAS, proveedor de códigos — sin cambios): `SUPER_ADMIN`, `SYSTEM_ADMIN`.

Roles de compañía cliente (nuevos, reemplazan `COMPANY_ADMIN`/`STORE_OPERATOR`):
- **OWNER** — dueño de la empresa. Superset: ve y puede todo lo que ve un `GENERAL_ADMIN`, más reportes/histórico financiero completo (wallet, recargas). Alcance: toda la compañía (todos los locales).
- **GENERAL_ADMIN** — gerente general. Opera el día a día de toda la compañía; es quien típicamente solicita/gestiona las recargas de wallet. Alcance: toda la compañía.
- **ADMIN** — gestiona un local específico (usuarios operadores de ese local, solicita códigos/activaciones). Alcance: un local.
- **OPERATOR** — activa tarjetas / solicita códigos dentro de su local. Alcance: un local.

## Fases

1. **Roles + AuthorizedPhone a nivel compañía** (fase actual en implementación). Migra el enum de roles y hace que `AuthorizedPhone` pertenezca a la compañía (con local opcional), no solo al local.

2. **Wallet (núcleo financiero)** — ✅ implementada (2026-07). Modelos `Wallet` (1:1 con `Company`) y `WalletTransaction` (`RECHARGE`/`CONSUMPTION`/`ADJUSTMENT`/`REFUND`). El wallet reemplaza la facturación por comisión.
   - **Recarga manual**: solo `SUPER_ADMIN`/`SYSTEM_ADMIN` desde `/wallets` acreditan saldo tras confirmar un pago externo. Las compañías (`OWNER`/`GENERAL_ADMIN`) tienen `/wallet` de solo lectura (balance + histórico).
   - **Saldo negativo permitido**: el balance negativo ES la deuda de la compañía; ninguna venta se bloquea por falta de saldo. `creditLimit` existe en el modelo pero sin enforcement (fase futura).
   - **Multi-moneda**: cada wallet tiene su moneda (default COP; soporta empresas en USD u otras). Cambio de moneda solo con balance en 0 (`changeCurrency`). Tasas de conversión en `SystemConfig` (`FX_USD_COP`, editable desde `/wallets`); si falta la tasa, el consumo queda `PENDING` (no afecta balance) para repreciar después — nunca bloquea la venta.
   - El débito ocurre dentro de la misma `$transaction` de los tres flujos: `activate-card.service.ts` (autoservicio), `purchase-codes.service.ts` (compra de códigos, que ahora también calcula `totalAmount` real si el producto tiene denominación única) y el webhook de WhatsApp (`api/webhook/activate`).
   - **A futuro**: recarga self-service vía PSE/tarjeta iniciada por `GENERAL_ADMIN` — el modelo ya trae `method` (`MANUAL`/`PSE`/`CREDIT_CARD`), `status` y `gatewayTransactionId`.
   - **Costos configurables** (✅ 2026-07): `ProductCost` — la plataforma define desde `/costs` cuánto le cobra a las compañías por producto/denominación: costo global (default) + tarifa negociada por compañía (en la moneda de su wallet). El débito resuelve: tarifa de la compañía → costo global → valor nominal de la denominación. `/prices` muestra a cada compañía su costo real vs su precio de venta (= margen).

3. **Catálogo de precios por organización** — ✅ implementada (2026-07). `CompanyProductPrice` (`companyId`, `productId`, `denominationId?`, `salePrice`, `currency`) — precio de venta al cliente final que cada compañía configura desde `/prices` (editable por `OWNER`/`GENERAL_ADMIN`; solo lectura para `ADMIN`/`OPERATOR`, que lo ven como referencia al comprar códigos). Es distinto del costo mayorista (denominación en USD) que se debita de la wallet. Además, la compra de códigos de productos multi-denominación ahora exige elegir denominación (`CodePurchase.denominationId`), con lo que el costo es determinable y el débito de wallet sale CONFIRMED (ya no queda PENDING).

4. **Dashboards** — ✅ implementada (2026-07).
   - Compañía (`OWNER`/`GENERAL_ADMIN`): `/overview` — stats (activaciones/compras hoy y 30 días, consumo, saldo), desglose por local y actividad reciente de todos los locales (qué se pidió, dónde, quién). Complementa `/wallet` (histórico financiero).
   - Plataforma (`SUPER_ADMIN`/`SYSTEM_ADMIN`): `/wallets` — saldo/deuda por compañía y pendientes; puede ver el `/overview` de cualquier compañía con el selector.
   - A futuro: reportes avanzados para `OWNER`.

5. **Trazabilidad de solicitudes**. Reforzar quién solicitó cada código (`CodePurchase.userId`) y quién activó cada tarjeta (`CardActivation.activatedBy`, ya es un `userId` real). Unificar el flujo de activar un QR pidiendo el código al proveedor en el momento (tarjeta sin `Key` preasignado) con el flujo de compra de códigos.

6. **Reporte anual (reemplaza facturación por comisión)**. `Invoice` pasa de corte diario/semanal por comisión a un estado de cuenta anual por compañía, generado desde `WalletTransaction`. Se marca `Company.billingFrequency`/`commissionRate` como deprecated (no se borra hasta migrar histórico). Reemplaza el cron `generateDailyInvoices` documentado en `main/database.md` (desactualizado).

## Visión de plataforma (contexto, no una fase con entregable concreto)

El objetivo de fondo no es solo backoffice de gift cards: es que estas empresas cliente migren su operación (inicialmente digital, luego física o conectada a canales como Shopify) y eventualmente Diem SAS les construya su sitio/tienda propio conectado a esta misma API — sin competir con Shopify, pero acercándose. El dolor actual de estas empresas es el desorden operativo; consolidar su operación digital aquí es el primer paso.

Esto no se construye ahora, pero condiciona el diseño de lo que sí se construye:
- Los servicios de dominio (`WalletService`, pricing, purchase/activation) se mantienen desacoplados de las rutas Next.js para poder exponerse después vía API pública/webhooks sin reescritura.
- El modelo de precios y de wallet vive a nivel `companyId`, no atado a un canal físico, para que un canal digital/web futuro los reutilice tal cual.

Fase futura (roadmap, fuera de scope hasta que se priorice): recarga self-service PSE/tarjeta, reportes avanzados, integraciones (API pública / conector Shopify / sitios propios para las empresas cliente).
