# Arquitectura: acceso y notificaciones transaccionales (oct 2026)

> **Actualización (19-oct-2026):** la §3 (identidad y acceso) quedó reemplazada por Clerk. Ver [`AUTH_CLERK_2026-10.md`](./AUTH_CLERK_2026-10.md). Las §4 y §5 (notificaciones) siguen vigentes.

Diseño técnico del plan [`PLAN_LOGIN_NOTIFICACIONES_2026-10.md`](./PLAN_LOGIN_NOTIFICACIONES_2026-10.md). Define dominios, modelos, relaciones, contratos y dónde vive cada pieza en diem-sas (Next.js 16 + Prisma) y diem-ai (FastAPI + SQLAlchemy).

## 1. Principios

**Organización (Next.js)**
- **Un módulo por dominio** en `src/modules/<dominio>/`, siguiendo `src/modules/account-statements`:

  | Archivo | Contenido |
  |---|---|
  | `domain.ts` | Reglas puras, sin Prisma ni red. Se prueban con `node --test`, como los tests actuales |
  | `*.service.ts` | Casos de uso con Prisma y transacciones (`import "server-only"`) |
  | `schemas.ts` | Validación de entrada con zod |

- **Rutas delgadas** (`src/app/api/**/route.ts`): `withAuth` → zod → servicio → respuesta. Es la convención del repo. No se mezclan server actions para mutaciones nuevas: una sola forma de autorizar (CASL `withAuth`) y de manejar errores (`AppError`).
- **Server Components** para la carga inicial de páginas nuevas; componentes cliente solo para interacción.
- **Trabajo después de responder** con `after()` de `next/server`. No hay crons en diem-sas (plan de Vercel).

**Datos (Prisma)**
- Invariantes en la base: `@@unique`, `CHECK` en la migración SQL y enums para estados nuevos. No se confía solo en el código.
- Las migraciones se escriben a mano y se verifican con `prisma migrate diff` contra el modelo, sin tocar ninguna base.
- Renombres con `@map`, sin migrar datos cuando el significado no cambia.
- `onDelete` explícito en cada relación nueva.
- Índices compuestos según la consulta real.
- **Secretos:** nunca en texto plano en la base (tokens con `sha256`, contraseñas con bcrypt). Las variables de entorno solo guardan secretos e infraestructura.
- **Transacciones:**
  - cambio de estado + aviso pendiente en la misma transacción;
  - ninguna llamada HTTP dentro de una transacción.

**Integración**
- diem-sas nunca envía correos directamente: delega en diem-ai por la conexión de fuentes estándar (`dk_live_…`, `POST /api/sources/events`).

## 2. Dominios y responsabilidades

| Dominio | Dónde | Dueño de | No hace |
|---|---|---|---|
| **Identidad y acceso** | diem-sas `src/modules/identity` | Usuarios, contraseñas, vinculación Google/Apple, sesiones, límites de intentos | Enviar correos |
| **Pedidos** (existe) | diem-sas `services/self-service`, `services/purchases` | `CodePurchase`, `ActivationJob` y sus transiciones | Decidir cómo se envía un aviso |
| **Notificaciones (lado emisor)** | diem-sas `src/modules/notifications` | Qué aviso corresponde a cada transición, destinatarios, outbox y entrega a diem-ai | Plantillas, proveedor, reintentos de envío |
| **Mensajería** | diem-ai | Recepción durable, plantillas, envío por Brevo, reintentos, rebotes y trazabilidad | Conocer usuarios o roles de diem-sas |

## 3. Identidad y acceso (diem-sas)

### 3.1 Modelos

```prisma
model User {
  // …campos actuales…
  /// Siempre en minúsculas y sin espacios (CHECK en la base); se compara normalizado.
  email              String               @unique
  passwordHash       String
  /// true cuando un admin asigna o restablece la clave; se apaga cuando el usuario la cambia.
  mustChangePassword Boolean              @default(false)
  passwordChangedAt  DateTime?
  /// Se incrementa al cambiar o restablecer la clave: invalida las demás sesiones (JWT).
  sessionVersion     Int                  @default(0)
  identities         UserIdentity[]
  passwordResets     PasswordResetToken[]
}

enum IdentityProvider {
  GOOGLE
  APPLE
}

/// Cuenta de Google o Apple vinculada desde Configuración. El login social solo acepta
/// un `sub` ya vinculado: nunca se vincula por coincidencia de correo.
model UserIdentity {
  id                String           @id @default(cuid())
  userId            String
  provider          IdentityProvider
  /// `sub` del proveedor: identificador estable, no cambia si cambia el correo.
  providerAccountId String
  /// Informativo (Apple puede dar un correo @privaterelay); nunca se usa para autenticar.
  email             String?
  linkedAt          DateTime         @default(now())
  lastUsedAt        DateTime?
  user              User             @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId]) // una cuenta de Google/Apple pertenece a un solo usuario
  @@unique([userId, provider])            // un usuario vincula como máximo una por proveedor
}

/// Enlace de "Olvidé mi contraseña". El token viaja solo en el correo; aquí queda su hash.
model PasswordResetToken {
  id          String    @id @default(cuid())
  userId      String
  tokenHash   String    @unique
  expiresAt   DateTime
  usedAt      DateTime?
  requestedIp String?
  createdAt   DateTime  @default(now())
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt])
}

/// Existente, generalizado: `subject` reemplaza a `userId` sin migrar datos (misma columna).
/// Valores: id de usuario (activaciones) o `login:email:<sha256>` / `login:ip:<sha256>`.
model RateLimitLog {
  id          String   @id @default(cuid())
  subject     String   @map("userId")
  storeId     String?
  action      String
  windowStart DateTime
  count       Int      @default(1)
  createdAt   DateTime @default(now())

  @@unique([subject, action, windowStart])
  @@index([subject, action, windowStart])
}
```

**Migración** (`…_identity_access`):
- columnas nuevas de `User`;
- tablas `UserIdentity` y `PasswordResetToken` con su enum;
- normalización de correos existentes, con verificación previa de colisiones (si hay alguna, la migración aborta con el detalle);
- `CHECK ("email" = lower(btrim("email")))`.

`RateLimitLog` no cambia en la base: el `@map` solo renombra el campo en el código.

**Auditoría:** `AuditLog` (existe) registra `password.changed`, `password.reset`, `password.assigned_by_admin`, `identity.linked`, `identity.unlinked` y `login.blocked`.

### 3.2 Reglas puras (`modules/identity/domain.ts`)
- `normalizeEmail(raw)`: `trim` y minúsculas, el mismo valor que exige el `CHECK`.
- `safeCallbackPath(raw)`: solo rutas internas (`/…`, no `//` ni esquemas). Si no es válida, devuelve el inicio del rol.
- `generateReadablePassword()`: palabras + 4 dígitos (`Mango-Rio-4827`) con `crypto.randomInt`.
- `passwordPolicy(password)`: mínimo 10 caracteres y no puede ser el correo. Devuelve los requisitos para mostrarlos en la UI.
- `hashToken(token)`: `sha256`; `newResetToken()`: 32 bytes aleatorios en base64url.
- `loginRateLimitSubjects(email, ip)`: claves con hash; no se guardan correos ni IP en claro.

### 3.3 Flujos (NextAuth v4, JWT)

**Correo + contraseña**
- `CredentialsProvider` → `login.service.authorizeCredentials`:
  1. normaliza el correo;
  2. verifica el límite de intentos por correo y por IP;
  3. compara la clave con bcrypt, en tiempo constante aunque el usuario no exista;
  4. registra el resultado.
- El JWT lleva `sessionVersion`. `getAuthenticatedActor` (ya lee el usuario en cada request) rechaza el token si no coincide: cambiar la clave cierra las demás sesiones sin consultas adicionales.
- El formulario respeta `callbackUrl` (vía `safeCallbackPath`) para que un enlace de correo lleve a la orden después de entrar.

**Contraseña olvidada**
1. `POST /api/auth/password/forgot {email}`:
   - siempre responde lo mismo;
   - si el usuario existe y no superó el límite, crea un `PasswordResetToken` (30 min) y pide el correo a diem-ai.
2. `GET /reset-password?token=…` (Server Component): valida el hash y muestra el formulario.
3. `POST /api/auth/password/reset {token, password}`, en una sola transacción:
   - marca el token como usado (compare-and-set sobre `usedAt` null);
   - guarda el hash nuevo;
   - `mustChangePassword=false`;
   - `sessionVersion++`;
   - escribe la auditoría.

**Asignación por admin y cambio sugerido**
- `users.service` (existe): al crear o restablecer la clave pone `mustChangePassword=true`. "Generar contraseña" usa `generateReadablePassword`.
- `PUT /api/account/password {current, next}`: valida la actual y aplica lo mismo que el restablecimiento.
- El aviso no bloqueante sale de `mustChangePassword` del actor (Server Component en el layout) y se puede cerrar por sesión.

**Google / Apple: entrar**
- `GoogleProvider` y `AppleProvider`.
- En el callback `signIn`:
  - busca `UserIdentity` por `(provider, sub)` con usuario activo;
  - si no existe, redirige a `/login?error=not_linked` ("Entra con tu correo y vincúlala desde Configuración");
  - si existe, actualiza `lastUsedAt`.

**Google / Apple: vincular desde Configuración**
NextAuth v4 sin adapter no vincula cuentas a una sesión existente. Por eso:
1. `POST /api/account/identities/{provider}/link` (sesión requerida) crea una intención de vínculo en una cookie httpOnly firmada de 5 min (`userId`, nonce) e inicia `signIn(provider)`.
2. En el callback `signIn`, si hay intención válida y el usuario coincide, crea `UserIdentity`. El `@@unique` impide vincular una cuenta que ya pertenece a otro usuario.
3. El callback devuelve la URL de Configuración, no una sesión nueva: la sesión actual sigue igual.
4. `DELETE /api/account/identities/{provider}` desvincula. La contraseña siempre queda, así que nunca se pierde el acceso.

- **Apple, detalles:**
  - el *client secret* es un JWT firmado en el servidor con la llave `.p8` (variable de entorno secreta), regenerado antes de sus 6 meses;
  - Apple responde con `form_post` entre sitios: las cookies `state`/`pkce`/`callback-url` de NextAuth se configuran con `SameSite=None; Secure`.

## 4. Notificaciones (diem-sas → diem-ai)

### 4.1 Contrato: `notification.requested` (orden explícita)
Los tipos canónicos de diem-ai (`sales.order.confirmed`, `fulfillment.delivered`…) son hechos para CRM y campañas. Un correo transaccional es una **orden explícita**:
- **diem-sas** decide destinatarios y plantilla, porque es dueño de usuarios y roles;
- **diem-ai** decide cómo se envía.

```jsonc
{
  "event_id": "ntf_<cuid>",                    // = NotificationOutbox.id → idempotencia
  "event_type": "notification.requested",
  "tenant_id": "<tenant Vercode>",
  "aggregate": { "type": "CodePurchase", "id": "<id>" },
  "occurred_at": "2026-10-18T15:04:05Z",
  "payload": {
    "category": "transactional",
    "template": "order_ready",                 // catálogo cerrado, versionado en diem-ai
    "locale": "es-CO",
    "recipients": [{ "email": "ana@empresa.co", "name": "Ana", "role": "buyer" }],
    "facts": {                                 // hechos bloqueados, sin códigos ni secretos
      "order_number": "A7K2", "product": "PlayStation Gift Card US$10 — USA",
      "quantity": 5, "total": "158.500", "currency": "COP", "company": "Virtual Zone"
    },
    "links": { "order": "https://<portal>/codes/purchases/<id>" },
    "sensitive": null                          // solo en password_reset; diem-ai lo borra al enviar
  }
}
```

### 4.2 Qué aviso corresponde a cada transición (`modules/notifications/domain.ts`, puro)
| Transición | Plantilla | Destinatarios |
|---|---|---|
| Orden creada y aún no lista | `order_received` | comprador |
| Orden creada (cualquier estado) | `order_received_admin` | OWNER/GENERAL_ADMIN activos de la empresa (sin el comprador) + equipo Diem |
| → `COMPLETED` | `order_ready` | comprador |
| → `ACTION_REQUIRED` / `FAILED` | `order_action_required` | comprador + equipo Diem |

- **Si la orden nace lista** (había stock), el comprador recibe solo `order_ready`, no dos correos seguidos.
- **Aplica igual a `CodePurchase` y `ActivationJob`.** La plantilla recibe `kind: "purchase" | "activation"` para el texto.
- **Equipo Diem:** `SystemConfig NOTIFY_ORDER_EMAILS` (lista en base, no en variable de entorno).
- `buildOrderNotifications(order, from, to, recipients)` devuelve las filas del outbox. Con eso se prueba la tabla anterior sin base de datos.

### 4.3 Modelo

```prisma
enum NotificationTemplate {
  ORDER_RECEIVED
  ORDER_RECEIVED_ADMIN
  ORDER_READY
  ORDER_ACTION_REQUIRED
}

enum NotificationStatus {
  PENDING    // por entregar a diem-ai
  ACCEPTED   // diem-ai respondió 202 (desde aquí los reintentos de envío son suyos)
  DEAD       // superó los intentos; visible para operación
}

/// Outbox: se escribe en la misma transacción que la transición de la orden,
/// así ningún aviso se pierde ni se envía sin que el cambio exista.
model NotificationOutbox {
  id            String               @id @default(cuid())
  template      NotificationTemplate
  aggregateType String               // "CodePurchase" | "ActivationJob"
  aggregateId   String
  /// Un aviso por transición aunque el compare-and-set se reintente:
  /// p. ej. "ORDER_READY:CodePurchase:<id>".
  dedupeKey     String               @unique
  /// Hechos y destinatarios ya resueltos (sin códigos ni secretos).
  payload       Json
  status        NotificationStatus   @default(PENDING)
  attempts      Int                  @default(0)
  availableAt   DateTime             @default(now())
  lastError     String?
  acceptedAt    DateTime?
  createdAt     DateTime             @default(now())

  @@index([status, availableAt])
  @@index([aggregateType, aggregateId])
}
```

Sin relación Prisma con `CodePurchase`/`ActivationJob` (agregado polimórfico). Se consulta por `(aggregateType, aggregateId)` y el historial sobrevive si la orden se archiva.

### 4.4 Escritura y entrega
- **Un único punto de enganche:** `recordOrderTransition(tx, order, from, to)`, en `modules/notifications/outbox.service.ts`. Lo llaman los compare-and-set existentes:
  - `purchase-codes.service`: creación y finalización;
  - `fulfillment-webhook.service`;
  - "Consultar Diem";
  - `activate-card.service`.

  Hace `createMany({ skipDuplicates: true })` dentro de la misma `tx`.
- **Entrega sin cron:** `flushOutbox(limit)`.
  1. Toma filas `PENDING` vencidas con `FOR UPDATE SKIP LOCKED` (`$queryRaw`).
  2. Las envía en lote a diem-ai, con 5 s de timeout y fuera de cualquier transacción.
  3. Marca `ACCEPTED` o reprograma con backoff (`availableAt`).
  4. Pasa a `DEAD` tras 8 intentos.
- **Se dispara:**
  - con `after()` justo después de responder en las rutas que crean o cambian órdenes;
  - en el layout del portal (también con `after()`), para recoger lo que haya quedado pendiente;
  - con `POST /api/ops/notifications/flush` (plataforma) para operación.
- **Cliente HTTP:** `modules/notifications/diem-ai.client.ts`. Lee `DIEM_AI_BASE_URL` y `DIEM_AI_SOURCE_KEY` (secretos).

### 4.5 Correos de acceso (no pasan por el outbox)
- `password_reset` lleva un enlace con token. Guardarlo en el outbox dejaría el secreto en texto plano en la base.
- Se pide a diem-ai **en la misma solicitud** del usuario, con `payload.sensitive.reset_url`.
- Si diem-ai no responde, el usuario ve "No pudimos enviar el correo, intenta de nuevo" y no se reintenta en segundo plano.

## 5. Mensajería (diem-ai)

### 5.1 Recepción
- `CanonicalEventType` suma `notification.requested`. Ese tipo exige el scope `notifications:send` en la `SourceConnection`, además de `events:write`.
- Conexión `diem-sas` en el tenant Vercode, con key `dk_live_…`.

### 5.2 Procesador de `SourceEvent` (pendiente en el diseño de fuentes)
- `services/source_event_processor.py`: registro `event_type → handler`.
- **Disparo:**
  - al aceptar el lote (`BackgroundTasks`, latencia de segundos);
  - con un barrido `POST /api/sources/process-pending` por el cron de Render, el mismo mecanismo de `dispatch-due`.
- **Estados:**
  - reclama con `FOR UPDATE SKIP LOCKED`;
  - `received → processing → processed`, o `error` con backoff;
  - pasa a `dead` tras N intentos;
  - cada evento corre en su propia transacción.

### 5.3 Envío transaccional
- **Handler** `services/transactional_notifications.py`:
  1. valida el payload con un modelo Pydantic `NotificationRequestedV1`;
  2. renderiza la plantilla;
  3. envía por `BrevoConnector.send_email_html`, un correo por destinatario.
- **Modelo nuevo** (`TenantBase`):

  ```python
  class TransactionalMessage(TenantBase):
      source_event_id   # FK SourceEvent
      recipient_email
      recipient_role    # buyer | company_admin | diem_team
      template
      status            # sent | failed | suppressed
      provider_ref      # message id de Brevo
      workflow_run_id   # FK WorkflowRun(workflow_name="transactional_email")
      # UNIQUE (tenant_id, source_event_id, recipient_email): un reintento nunca duplica un correo
  ```

- **Plantillas:**
  - viven en el repo (`templates/transactional/<plantilla>.html.j2` + `.txt.j2`), versionadas y revisadas como código;
  - se renderizan con Jinja2 en sandbox y autoescape;
  - sin LLM: el contenido son hechos bloqueados;
  - remitente: el de Vercode, por `store_name`.
- **Consentimiento:** `category: "transactional"` no exige opt-in de marketing (es un mensaje necesario del servicio). Sí respeta la supresión por rebote duro o bloqueo (webhook `/webhooks/brevo/events`, existe). Se documenta como excepción explícita a la regla 2 de `CLAUDE.md` de diem-ai.
- **Secretos:** después de enviar, `payload.sensitive` se pone en `null` en el `SourceEvent`. El enlace de recuperación no queda guardado.

## 6. Estructura de archivos (diem-sas)

```
src/modules/identity/
  domain.ts                 normalizeEmail, safeCallbackPath, generateReadablePassword, passwordPolicy, tokens
  login.service.ts          authorizeCredentials (límite de intentos + auditoría)
  password.service.ts       forgot, reset, change, assignByAdmin
  identity-link.service.ts  intención de vínculo, link, unlink, resolveSocialLogin
  rate-limit.service.ts     generalización del actual (subject)
src/modules/notifications/
  domain.ts                 buildOrderNotifications, destinatarios, dedupeKey
  outbox.service.ts         recordOrderTransition(tx, …), flushOutbox
  diem-ai.client.ts         POST /api/sources/events
src/lib/auth-options.ts     providers + callbacks (delgado: delega en modules/identity)
src/app/(auth)/login, forgot-password, reset-password
src/app/(root)/settings/security        contraseña + cuentas vinculadas
src/app/api/auth/password/{forgot,reset}/route.ts
src/app/api/account/password/route.ts
src/app/api/account/identities/[provider]/{link}/route.ts
src/app/api/ops/notifications/flush/route.ts
tests/identity-domain.test.mjs, tests/notifications-domain.test.mjs
```

## 7. Variables de entorno nuevas (solo secretos e infraestructura)
- **diem-sas:**
  - `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`;
  - `APPLE_CLIENT_ID` (Services ID), `APPLE_TEAM_ID`, `APPLE_KEY_ID` y `APPLE_PRIVATE_KEY`;
  - `DIEM_AI_BASE_URL` y `DIEM_AI_SOURCE_KEY`.
- **diem-ai:** ninguna nueva. Brevo ya está configurado por tenant (`IntegrationConfig`).
- **Configuración de negocio** en base de datos: `NOTIFY_ORDER_EMAILS` en `SystemConfig`, editable por plataforma.

## 8. Riesgos y mitigaciones
| Riesgo | Mitigación |
|---|---|
| Apple pierde cookies en `form_post` (NextAuth v4) | Cookies `SameSite=None; Secure`; prueba en Safari iOS antes de liberar |
| Correos de código o recuperación en spam | Dominio de Vercode con SPF/DKIM/DMARC en Brevo antes de lanzar |
| Doble correo por reintentos | `dedupeKey` en diem-sas, `event_id` en la ingesta y `UNIQUE (source_event_id, recipient_email)` en diem-ai |
| Aviso perdido si diem-ai está caído | Outbox durable; se reintenta con `after()`, al navegar el portal y con el flush manual |
| Enumeración de correos | Misma respuesta y mismo tiempo en login y "olvidé mi contraseña" |
| `activate-card.service` tiene cambios locales sin commitear | Coordinar antes de agregar el enganche de notificaciones |

## 9. Fuera de alcance (recomendado después)
- Convertir `CodePurchase.status` y `ActivationJob.status` (hoy `String`) en enums de Prisma, para que la base rechace estados inválidos.
- Publicar también los hechos canónicos (`sales.order.confirmed`, `fulfillment.delivered`) para el CRM y las campañas de diem-ai.
