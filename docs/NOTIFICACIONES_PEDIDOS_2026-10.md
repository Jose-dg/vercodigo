# Avisos por correo de pedidos (oct 2026)

Correos transaccionales de compras de códigos y activaciones QR, enviados por **diem-ai** con lo que ya tiene: clientes y consentimiento (`customers/resolve`), eventos de scheduling con email por Brevo y contenido determinista sin LLM. No hay cron ni tablas nuevas.

## Quién recibe qué
| Momento | Comprador | Dueño/admin de la empresa | Equipo Diem |
|---|---|---|---|
| Orden creada y abierta (en proceso / en espera de stock) | Pedido recibido | Nuevo pedido | Nuevo pedido |
| Orden creada y ya lista | Pedido listo (un solo correo) | Nuevo pedido | Nuevo pedido |
| Pasa a `COMPLETED` | Pedido listo | — | — |
| Pasa a `ACTION_REQUIRED` / `FAILED` | Requiere atención (motivo genérico) | — | Requiere atención (con el detalle técnico) |

- Los códigos **nunca** van en el correo: el enlace lleva a la orden (`/codes/purchases/<id>` o `/codes/activations/<uuid>`), detrás del login.
- El comprador no recibe el aviso de admin aunque también sea dueño. Cada correo sale una sola vez por destinatario.
- Equipo Diem: `SystemConfig NOTIFY_ORDER_EMAILS` (correos separados por coma o salto de línea).

## Flujo
1. Una operación termina con la orden en un estado; esto pasa en el checkout (`purchaseCodes`), al procesarla (`processCodePurchase`: "Consultar Diem", recuperación manual, webhook de DevDiem) y en las activaciones (creación en `/api/cards/activate` y sus 4 puntos de proceso).
2. `notifyCodePurchase` / `notifyActivationJob` (`src/modules/notifications`) corren **después de responder** (`after()`):
   - aplican las reglas puras (`domain.ts`);
   - por cada aviso, registran al destinatario en diem-ai (`POST /api/scheduling/customers/resolve`, opt-in transaccional de email);
   - piden el correo (`POST /api/scheduling/events` con `channel: "email"`, `dispatch: "now"` y `callback_url`).
3. diem-ai lo envía **en esa misma solicitud**, sin esperar a `dispatch-due`, con un solo intento. Luego confirma a `POST /api/webhook/diem-ai` con `sent`, `skipped` o `failed`, más el `provider_ref` de Brevo.
4. Todo queda en `AuditLog`:
   - `notification.requested`, o `notification.request_failed` si diem-ai no respondió;
   - `notification.sent`, `notification.skipped` o `notification.failed` según la confirmación.

**Idempotencia:** `external_ref = sas:<plantilla>:<CodePurchase|ActivationJob>:<id>:<destinatario>`. diem-ai devuelve el evento existente y no reenvía, así que repetir el aviso de un estado es inofensivo.

**Fallos:** se intenta una vez. Si diem-ai no responde, queda `notification.request_failed` y ese correo no sale.

## Cambios en diem-ai (sobre lo existente)
- `POST /api/scheduling/events` acepta `dispatch: "now"` (envío inmediato con un intento) y `callback_url`, validada con `_validate_callback_url` y `ALLOWED_CALLBACK_DOMAINS`. Con `external_ref` repetido devuelve el evento existente.
- `dispatch_event_now`: el mismo claim con lease que `dispatch-due`, acotado a un evento. Así el barrido y el envío inmediato nunca envían dos veces. Si no se envía, queda `FAILED`.
- `post_dispatch_receipt` (`core/django_client.py`): callback con el token interno, best-effort.
- Plantillas en `services/email_content.py`: `order_received`, `order_received_admin`, `order_ready`, `order_action_required` y `order_action_required_admin`. Los hechos se escapan en el HTML.

## Variables de entorno de diem-sas (secretos e infraestructura)
| Variable | Qué es |
|---|---|
| `DIEM_AI_BASE_URL` | URL de diem-ai |
| `DIEM_AI_INTERNAL_TOKEN` | Token interno de diem-ai (secreto). Autentica las llamadas y el callback |
| `DIEM_AI_TENANT_ID` | Tenant de Vercode en diem-ai |

Sin las tres, los avisos se omiten en silencio y la compra no se afecta. Los enlaces y el callback usan la URL canónica existente (`marketingConfig.brand.canonicalUrl`, `https://vercode.me`).

## Puesta en marcha
1. **diem-ai** (primero):
   - desplegar los cambios;
   - crear el tenant Vercode;
   - configurar Brevo con `scripts/configure_tenant_brevo.py` (remitente de Vercode verificado con SPF/DKIM/DMARC);
   - habilitar la automatización `reminder_dispatch` del tenant;
   - incluir `vercode.me` en `ALLOWED_CALLBACK_DOMAINS`.
2. **diem-sas:**
   - las 3 variables en Vercel;
   - `NOTIFY_ORDER_EMAILS` en `SystemConfig`.
3. **Probar:** una compra real de bajo valor. Verificar el correo y las filas `notification.*` en `AuditLog`.

## Verificación hecha
- diem-sas:
  - 8 tests de reglas (`tests/order-notifications.test.mjs`) y todas las suites (107);
  - `tsc`, lint de lo tocado y `next build`.
- diem-ai:
  - tests de plantillas (7);
  - tests del claim inmediato y del resultado;
  - `test_route_auth`: ninguna ruta sin token.
- **Punta a punta contra diem-ai local** (base desechable con todas las migraciones aplicadas desde cero, payloads idénticos a los del cliente de diem-sas, `OUTBOUND_MODE=SANDBOX`):
  - resolve → opt-in de email;
  - `dispatch: "now"` envía en la misma solicitud y confirma por callback con el token;
  - el mismo `external_ref` devuelve el mismo evento sin reenviar (un solo callback);
  - sin token, 401;
  - destinatario fuera del sandbox → `skipped`;
  - destinatario permitido con llave falsa de Brevo → `failed` con un solo intento (`attempt_count = 1`).
- La prueba encontró que el motivo de falla llegaba como objeto (`error_detail` JSON). diem-ai ahora envía texto y el webhook acepta ambos.
- Falta solo el envío real por Brevo, que requiere la llave y el remitente de Vercode.

## Pendiente
- Los cambios de diem-ai están en el working tree de la rama `feat/multi-tenant-solid`, junto al WIP de José (capa de fuentes, Fase 0), y **no están commiteados**.
- En `api/routers/scheduling.py`, `update_event` tiene un `TODO`: se perdieron 6 líneas del WIP al restaurar un respaldo; hay que reponerlas.
