# Fase: activaciones visibles + endurecimiento del fulfillment Diem (oct 2026)

## Contexto

- **Disparador.** El operador activaba tarjetas QR y no las veía en "Mis solicitudes": no sumaban en los contadores.
- **Auditoría.** Se revisó el uso del contrato de fulfillment de Diem en los dos flujos: activación QR (`ActivationJob`) y compra de códigos (`CodePurchase`).
- **Lo que ya estaba bien:**
  - un mismo cliente para los dos flujos;
  - `source` correcto (`physical_card` / `partner_api`);
  - clave de idempotencia estable;
  - el webhook solo dispara, y siempre se vuelve a consultar a Diem;
  - reveal antes de cobrar;
  - cobro con compare-and-set.
- **Huecos encontrados:** los cuatro que se corrigen abajo.

## Lo hecho

### 1. Activaciones en "Mis solicitudes" (`3c646d7`)
- **Fuentes de la lista.** `listFulfillmentOrdersForUser` une:
  - las compras;
  - las `CardActivation` cobradas;
  - los `ActivationJob` sin liquidar (uno por tarjeta).

  Usa la misma visibilidad por rol que las compras: plataforma, empresa, tienda o usuario.
- **Serializador puro** (`src/lib/codes/fulfillment-order.ts`):
  - produce la misma forma de fila, con `kind` y `detailHref`;
  - un job COMPLETED sin `CardActivation` aparece como "Acción requerida".
- **Detalle de activación:** `/codes/activations/[uuid]`, que reutiliza `OrderDetail`.
- **Reintento:** `POST /api/codes/activations/[uuid]`.

### 2. Una activación nunca queda COMPLETED sin cobro (`a4dd26e`)
- **Antes del claim** se verifica la tarjeta dentro de la transacción. Si ya estaba activada por otra vía: rollback y `ACTION_REQUIRED`, guardando el código entregado.
- **Ruta retirada.** `/api/webhook/activate` (n8n/WhatsApp) ahora responde 410. Activaba y cobraba sin Diem y sin firma, no tenía consumidores y nunca hubo activaciones por teléfono en producción.

### 3. Reintentos sin 409 de idempotencia (`5ac67ea`)
- **Comando congelado.** El comando exacto enviado a Diem se guarda en `diemRequestSnapshot` (migración aditiva) y cada reintento lo reenvía. Se envía como JSON canónico con claves ordenadas, igual que el hash de Diem, así que el round trip por JSONB queda idéntico byte a byte.
- **409 de idempotencia = error de contrato:**
  - compra: pasa a `ACTION_REQUIRED`;
  - activación: pasa a `ACTION_REQUIRED` y conserva el bloqueo de la tarjeta.
- **Montos.** `computeCost` redondea a centavos, así que cotización, débito y orden de Diem salen del mismo valor.
- **Script de integración.** `test:concurrency` ahora ejecuta todos los archivos de integración; antes solo corría el primero.

### 4. Eventos posteriores a la entrega (`88ee9b4`)
- **`cancelled` después de COMPLETED:**
  - se reconsulta Diem;
  - CAS de COMPLETED a **REVERSED**;
  - en la misma transacción, `REFUND` ligado por `WalletTransaction.reversalOfId` (único: un replay no reembolsa dos veces);
  - queda auditado.
- **`delivery_pending` después de COMPLETED (código reemplazado):**
  - se hace un nuevo reveal y se guarda el reemplazo, sin cobrar de nuevo;
  - en activaciones, la tarjeta apunta a la Key nueva.
- **`wallet:verify`:**
  - una compra REVERSED debe tener cada consumo reembolsado exactamente una vez;
  - una COMPLETED no debe tener reembolsos.

## Despliegue

- **Migraciones:**
  - `20261011120000_freeze_diem_request_snapshot`
  - `20261011130000_wallet_consumption_reversal`

  Las dos son aditivas y anulables. Se aplican solas en el build de producción (`scripts/vercel-build.mjs` → `prisma migrate deploy`).
- **Después del deploy:**
  - `npm run wallet:verify` sin hallazgos (el script nuevo necesita la columna `reversalOfId`);
  - en "Mis solicitudes" de una tienda, sus activaciones aparecen como "Activación QR".

## Pruebas

| Tipo | Archivo |
|---|---|
| Unitarias | `fulfillment-order`, `devdiem-fulfillment` (comando congelado, 409), `ledger-verification` (reversos), `purchase-quote` (centavos) |
| Integración (Postgres local + Diem falso) | `activation-settlement`, `diem-request-snapshot`, `post-delivery` |

- **Cómo se corre la integración:**
  ```
  TEST_DATABASE_URL=postgresql://<user>@localhost:5432/diemsas_concurrency_test npm run test:concurrency
  ```
- **Validación de las pruebas:** cada prueba de regresión se verificó contra el código anterior y falla con él.

## Lo que sigue

1. **Diem: reasignación automática de `awaiting_stock`.**
   - Hoy un pedido en espera solo se reasigna con un retry de staff (`processing.py` deja `next_attempt_at=None`).
   - Al cargar códigos al pool, Diem debería reintentar los pedidos en espera de ese producto, en orden de llegada.
   - Fue la causa de los dos Roblox atascados del 10 oct.
2. **Reemplazo en compras de varias unidades.** Diem bloquea el reveal si otra unidad se reveló hace más de 15 min (`FULFILLMENT_REREVEAL_WINDOW_SECONDS`). SAS deja el motivo en `lastError`, pero el reemplazo requiere intervención.
3. **Activación REVERSED.** La tarjeta queda activada con un código anulado. Falta definir el flujo de reemisión (liberar la tarjeta frente a la facturación de la `CardActivation`).
4. **Cron de reconciliación.** `vercel.json` tiene `crons: []`, así que `POST /api/jobs/fulfillment` no corre solo. Si un webhook se pierde, el pedido espera hasta un reintento manual.
