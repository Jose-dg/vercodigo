# Fase 1 — Entrega de códigos al email del cliente final (oct 2026)

## Qué se resolvió

Una empresa puede comprar códigos en diem-sas y pedir que **Diem los envíe por email a su propio cliente**, por ejemplo Netflix mensual a sus clientes o a sus empleados, o un cupón incluido en la venta de internet. El comprador sigue viendo y copiando los códigos en el portal.

**Quién entrega:** DevDiem, con la entrega gestionada que ya usaba Shopify (`delivery_mode=managed_and_partner`). diem-sas no envía correos con códigos ni guarda el estado del envío: solo lo refleja.

## Cambios

### DevDiem — rama `feat/code-delivery-end-customer` (desde `feat/asgi-realtime-migration`), commit `a4f753f`

- **Bug corregido** (`apps/fulfillment/reveal.py`): en `managed_and_partner`, cuando el partner revelaba los códigos, la solicitud pasaba a `delivered`. La tarea del email veía `delivered` y no enviaba nada: el cliente no recibía el correo y todo aparecía como entregado.
  - Ahora solo `finalize_managed_email` (cuando el proveedor acepta el envío) cierra la entrega.
  - La ventana de re-revelado del partner se cuenta desde su propia primera revelación (eventos `PARTNER_API`), no desde `revealed_at`, que también marca el email.
- Tests: `test_delivery.ManagedAndPartnerDeliveryTests` (4). Fallan con el código anterior. Fulfillment queda en 197 tests; las 4 fallas que aparecen ya estaban en la rama base.

### diem-sas — rama `feat/code-delivery-end-customer`, commit `cae7290`

- **Checkout:** casilla "Enviar los códigos al email de mi cliente" con nombre, apellido, email y la autorización de datos (Ley 1581). Va en `DeliveryRecipientFields.tsx` y la valida `normalizeDeliveryRecipient`.
- **Sin modelos nuevos:**
  - El destinatario se guarda en `diemRequestSnapshot`, en la misma transacción que crea la compra.
  - Reusar la misma `Idempotency-Key` con otro destinatario devuelve 409.
- **Estado del email:** después de liquidada la compra, `recordRecipientDelivery` refleja en `fulfillmentStatus` el estado real en Diem.
  - Lee el estado de Diem en vez de confiar en el payload, así que eventos desordenados no lo hacen retroceder.
  - Si el envío falla, queda una sola auditoría `CODE_PURCHASE_RECIPIENT_EMAIL_FAILED`.
- **UI:** el detalle muestra "Entrega a tu cliente" con el destinatario y el estado (enviando / enviado / falló), y "Mis solicitudes" muestra "Para x@y · estado".
- `test:concurrency` ahora corre con `--conditions=react-server`. Fallaba en `main` antes de este cambio porque no podía importar módulos `server-only`.
- Tests: `tests/delivery-recipient.test.mjs` y dos integraciones nuevas (fijado del destinatario + idempotencia, y reflejo del estado del email). En total: 43/43 de integración y 48/48 en `test:devdiem`.

## Antes de usarlo en producción

1. Deploy de DevDiem con `a4f753f`. Sin él, el email se puede perder si diem-sas revela primero.
2. En prod, `FULFILLMENT_MANAGED_EMAIL_ENABLED=True` y un `EmailBrandProfile` activo para la store/canal del service account de diem-sas. Sin marca, DevDiem **no envía**: la compra queda en `ACTION_REQUIRED` y no se debita.
3. Hoy el correo sale con la marca de esa store, no con la de cada empresa. Ver Fase 2.

## Lo que sigue

- **Fase 2 — marca por empresa y `vercode.me`:**
  - Un `EmailBrandProfile` por empresa de diem-sas (nombre y logo de la empresa).
  - `EmailBrandProfile.sending_account` para enviar con la cuenta Brevo de `vercode.me`, sin fallback a la cuenta Diem.
  - Montar SPF/DKIM/DMARC, la página pública y el plan de calentamiento del dominio.
- **Reenviar / enviar a otro email:** endpoint de partner en DevDiem (hoy el reenvío del operador solo cubre órdenes, no service accounts) y botón en el detalle.
- **Aviso al comprador** cuando el email falla (plantilla en diem-ai). Hoy solo queda la auditoría.
- **CSV de varios destinatarios:** una compra por persona usando el mismo servicio.
- **API para empresas** (`POST /api/v1/deliveries`) sobre `purchaseCodes({ recipient })`.
