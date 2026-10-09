# Fase: compras de códigos idempotentes y contrato de origen canónico (2026-10-09)

## Incidente

- 7 compras de códigos se debitaron dos veces en la wallet (3 compañías). En Virtual Zone el cobro extra fue de $360.000.
- No hubo doble fulfillment: cada solicitud asignó, reveló y entregó un único PIN.
- La compra `cmuwznpcp00028ehobr6r8nop` no permitía corregir su origen ("Diem no puede corregir el origen").

## Causa raíz

1. **Transiciones de estado no monótonas.** `processCodePurchase` se ejecuta en paralelo desde varios puntos: checkout inline, webhook `allocated`/`delivered`, `POST /api/codes/purchases/[id]` y el job de recuperación. Al revelar, un proceso tardío escribía `status: "PENDING"` sin condición sobre una compra que ya estaba COMPLETED, la volvía a reclamar y debitaba otra vez. Las ramas FAILED, ACTION_REQUIRED y PENDING también escribían el estado sin condición.
2. **No había invariante en la base.** `WalletTransaction.codePurchaseId` tenía un índice, pero no una restricción única.
3. **El contrato de origen no se validaba en la entrada de Diem.** `repair_virtual_zone_history` escribió `{"kind":"company"}` y 11 `{"kind":"phone"}` sin `id`. El corrector esperaba `id` y fallaba con 500.

## Qué se hizo

### Diem-SAS
- **Máquina de estados** (`src/services/self-service/code-purchase-state.ts`):
  - COMPLETED y FAILED son absorbentes.
  - Toda escritura concurrente es un compare-and-set "mientras siga abierta" (`updateOpenCodePurchase`).
  - FINALIZING deja de usarse como destino.
- **Liquidación atómica** (`settleCodePurchase`):
  - Una sola transacción hace el CAS `open → COMPLETED` y debita una vez, solo en el proceso que gana.
  - Si encuentra un consumo existente en una compra abierta, aborta (no lo ignora en silencio).
  - P2002 sobre `codePurchaseId` se registra y se devuelve el estado ya liquidado.
  - Las llamadas HTTP a Diem quedan fuera de la transacción y son idempotentes (`idempotencyKey` y `correlationId`).
- **Invariante en la base:** `@unique codePurchaseId` (migración `20261009190000_unique_wallet_consumption_per_purchase`).
- **Mismo tipo de bug corregido en otros flujos:**
  - `ActivationJob`: CAS en todas las transiciones; solo el proceso que falla el trabajo libera el bloqueo de la tarjeta.
  - Webhook: no modifica compras ni activaciones liquidadas y rechaza un `code_request_id` distinto.
  - `/api/jobs/retry`: ahora es un reporte de solo lectura. Antes reabría trabajos FAILED a PROCESSING y los dejaba huérfanos.
- **Contrato único del origen:** `src/lib/purchases/origin-snapshot.ts` se usa al crear, al corregir y al exportar.
- **Reparación de datos (ya aplicada):**
  - Los 7 duplicados se conservaron como FAILED, desvinculados y auditados (`DUPLICATE_WALLET_CONSUMPTION_REPAIRED`).
  - Saldos resultantes: Virtual Zone −2.214.650, Lab −6.711.500, `cmtxjz56…` −1.068.000.
- **Guardrail `npm run wallet:verify`** (solo lectura; sale con código 1 si encuentra hallazgos). Verifica:
  - saldo = reconstrucción del ledger activo
  - `balanceAfter` correcto en cada movimiento
  - exactamente un consumo por compra COMPLETED
  - ningún consumo en compras no liquidadas

  Las compras reclasificadas fuera del historial activo, que solo tienen consumos FAILED vinculados, se reportan como `reconciledExclusions`. Hoy son 7, de Laboratorio Clínica del Play, reclasificadas el 2026-08-13.
- **Pantallas:** `/costs` indica que muestra el historial comercial (últimas 50, incluidas compras anteriores al saldo anterior). `/wallet` indica que muestra movimientos desde el saldo anterior.

### Diem
- `apps/fulfillment/purchase_origin.py`: `canonical_purchase_origin` es el único contrato. Admite `null`, `phone{id,label,phone}` o `store{id,label}`; cualquier otra forma da 422 o 400, nunca 500.
- Validación en la entrada: `CodeRequestCreateSerializer` y `PartnerCheckoutIntentCreateSerializer` rechazan orígenes no canónicos.
- `origin_correction.py`: se quitó la compatibilidad con `company`. Un origen guardado no canónico ahora da un 422 explícito que indica qué comando ejecutar.
- `manage.py normalize_purchase_origins plan|apply`:
  - Usa el manifiesto de Diem-SAS (`npm run origins:export`) con hash.
  - Nunca adivina ids: exige que el significado se mantenga (mismo teléfono, o `company → null`).
  - Usa fingerprint, `select_for_update` y un `OrderCommand` por orden como auditoría.
  - Es idempotente.
- Se retiró `repair_virtual_zone_history`: si se volvía a ejecutar, reintroducía el formato legacy.

## Pruebas

- **Diem-SAS:** `npm run test:concurrency` contra Postgres local desechable y un Diem simulado. Prueba 5 procesos en paralelo, `processing` tardío, `failed` tardío y el rechazo de un segundo consumo.
  - Contra el código anterior, 3 de 4 fallan: reproduce el bug, incluido el paso COMPLETED → FAILED.
  - Con el código nuevo, 4 de 4 pasan.
- **Unitarios Diem-SAS:** transiciones, CAS y `verifyLedger`. `test:wallet-ledger` pasa 15 de 15.
- **Diem:** contrato canónico, rechazo en la entrada, 422 sobre dato legacy, y el comando de normalización (cambio de significado rechazado, plan/apply idempotente). `apps.fulfillment` + `apps.sales`: 317 tests.
- **Fallas previas a esta fase, no relacionadas** (también fallan en HEAD limpio):
  - `test_customer_hold_migration`
  - `test_managed_action_required_email_api_works_while_order_pending`
  - el test de stock de `test:devdiem`

## Pendiente (requiere aprobación de José; toca producción)

1. **Diem:** aplicar la normalización. El plan ya está generado: 12 filas, fingerprint `df176979e9eb…`, ninguna facturada.
   ```bash
   M=../diem-sas/.secure/canonical-purchase-origins.json
   python3 manage.py normalize_purchase_origins apply --manifest $M \
     --manifest-sha256 $(shasum -a 256 $M | cut -d' ' -f1) \
     --receipt ../diem-sas/.secure/normalize-origins-plan.json \
     --report ../diem-sas/.secure/normalize-origins-report.json \
     --expected-database diem_martian_tkcc_4i8k --actor-email <superusuario>
   ```
2. **Diem-SAS:** ejecutar `npx prisma migrate deploy` (índice único) y verificar que existe `WalletTransaction_codePurchaseId_key`.
3. **Desplegar ambos servicios.** El orden es indiferente: Diem-SAS ya enviaba la forma canónica en la creación, y mientras no se aplique el paso 1, el corrector responde 422 explícito en lugar de 500.
4. Programar `npm run wallet:verify` como cron con alerta.
5. Corregir el origen de `cmuwznpcp00028ehobr6r8nop` desde `/costs`.
