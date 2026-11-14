# Fase: marca blanca en textos visibles (nov 2026)

Rama `feat/marca-blanca-textos` (desde `main`), sin commit.

## Por qué
El portal es marca blanca. La interfaz, los toasts, los errores guardados (`lastError`), los correos al comprador, la documentación de la API y el manifest PWA decían "Diem" ("Pendiente en Diem", "Consultar Diem", "Diem exige revisión manual…"). Un cliente con el portal abierto frente a otra persona revelaba quién está detrás.

## Qué se hizo
- **Vocabulario único**: revisión manual / `ACTION_REQUIRED` → "Requiere aprobación"; en espera → "Requiere confirmación"; botones "Consultar estado" / "Reintentar"; errores del proveedor → "el proveedor"; sin stock → "Sin stock por ahora"; reembolsos → "Reembolso: compra X anulada"; "Pago confirmado".
- **Cliente**: historial y detalle de órdenes, checkout, envío al cliente, activar tarjeta, /scan, QR, activación en bloque, línea de tiempo (`purchase-timeline.ts`).
- **Servicios**: todos los mensajes que llegan a la UI o se guardan en `lastError` / descripción de wallet (activate-card, purchase-codes, post-delivery, repricing, origin-correction, cliente del proveedor en `lib/devdiem/fulfillment.ts`, rutas API).
- **Correos**: motivo al comprador "La solicitud requiere aprobación antes de entregar los códigos."; etiqueta de estado "Requiere aprobación"; nombre del equipo "Equipo de operaciones".
- **Plataforma**: menú "Operaciones de catálogo", selector "Plataforma / Administración", Tarifas, Productos ("ID de producto en el proveedor"), diagnóstico de conexión.
- **Desarrolladores**: `DIEM_API_KEY` → `CODES_API_KEY` en ejemplos y prompt; textos sin marca.
- **PWA**: `manifest.json` → "Vercode".
- Constantes compartidas en `src/lib/codes/customer-messages.ts` (`PRODUCT_NOT_MAPPED`, `REQUIRES_APPROVAL`).

No cambió: identificadores (`devDiemProductId`, `diemRequestId`, prefijos `DIEM-SAS-*`), códigos de error (`DIEM_UNAVAILABLE`…), variables de entorno reales, rutas (`/ops/diem`), rol `diem_team`, comentarios ni logs. Los flujos y estados son los mismos.

## Datos ya guardados
`scripts/neutralize-brand-texts.ts` reescribe `lastError` (CodePurchase, ActivationJob, SalePriceCorrection) y `WalletTransaction.description` con la marca. `plan` solo lee; `apply` respalda en `.backups/` y actualiza con compare-and-set (idempotente). Lo que no tenga regla se lista y no se toca. Los estados de cuenta no usan esa descripción, así que no se alteran.

Ensayo local (`diemsas_clerk_e2e`): 6 textos, 0 sin regla; segunda corrida: 0.

## Verificación
- `tsc --noEmit` limpio; 239 tests unitarios pasan. Falla 1 que ya fallaba antes (`orm-only.test.mjs`: SQL a mano en `api-keys/service.ts`, `dashboard.service.ts`, `reset-reversed-card.service.ts`, archivos que esta fase no toca).
- eslint sin errores nuevos (los 2 de `scanner-components.tsx:59` ya existían).
- grep: no queda "Diem" en textos visibles de `src/` ni `public/`.
- No se probó en navegador.

## Lo que sigue
1. Revisar en navegador: Mis solicitudes (pendiente / requiere aprobación), checkout sin stock, envío a cliente, activar tarjeta, /scan, wallet, docs, menú de plataforma.
2. Commit + deploy.
3. En prod: `npx tsx scripts/neutralize-brand-texts.ts plan --expected-database <db>`, revisar lo que aparezca sin regla y luego `apply`.
4. Fuera de este repo: `remote.last_error_summary` lo escribe DevDiem y se muestra tal cual. Si trae la marca, hay que neutralizarlo allá. Revisar también las plantillas de correo en diem-ai (remitente y firma).
