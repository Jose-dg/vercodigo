# Plan: acceso, notificaciones por correo y responsive (oct 2026)

> **Actualización (19-oct-2026):** el acceso (contraseña, Google, Apple, recuperación) se resolvió con Clerk. Ver [`AUTH_CLERK_2026-10.md`](./AUTH_CLERK_2026-10.md). Las notificaciones de pedidos siguen como aquí.

## Contexto
Los clientes **aún no tienen acceso** al portal: hoy el equipo Diem compra y entrega por ellos desde el programa. Este proyecto **es el lanzamiento a clientes**, así que se diseña el estado final, sin transición ni cuentas heredadas que cuidar. El primer ingreso y la primera compra no deben tener ninguna barrera.

## Objetivo
Que nadie tenga que escribir por WhatsApp para entrar o para saber si su pedido está listo:
- Entrar con correo y contraseña, y que quien quiera pueda vincular Google o Apple para entrar con un toque.
- Que olvidar la contraseña nunca obligue a escribir por WhatsApp.
- Recibir un correo cuando se crea el pedido, cuando está listo para reclamar y cuando requiere atención.
- Que el admin (equipo Diem y dueño de la empresa) sepa al instante que entró un pedido.
- Que el login, la compra y la página de la orden con sus códigos funcionen bien en el celular.

## Lo que hay hoy (diagnóstico)
| Hallazgo | Efecto |
|---|---|
| No existe "olvidé mi contraseña" | La única salida es WhatsApp |
| El email se busca tal cual (`findUnique({ email })`) | `Jose@…` o un espacio final (teclado del celular) falla con la clave correcta: parece clave olvidada |
| El login ignora `callbackUrl` y siempre manda al inicio | Un enlace a una orden (p. ej. desde un correo) pierde el destino tras iniciar sesión |
| El admin crea la contraseña del usuario (`user-form.tsx`, `users.service`) | Se mantiene para un primer ingreso sin fricción; falta pedir el cambio después y evitar claves débiles |
| Sin límite de intentos en el login | Fuerza bruta posible |
| diem-ai envía email (Brevo) solo en campañas con LLM; el dispatcher de recordatorios solo WhatsApp | No hay envío transaccional por evento |
| diem-ai acepta eventos de fuentes (`POST /api/sources/events`, keys `dk_live_…` con scopes) pero el procesador (`process-pending`) no existe | Los eventos se guardan pero nadie los procesa |
| diem-sas no puede usar crons (plan de Vercel, `875693b`) | El envío no puede depender de un cron en diem-sas |
| La orden ya es responsive en estructura; "Copiar códigos" no espera al portapapeles | En iOS puede decir "copiados" sin copiar |

## Decisiones tomadas
- **Base: correo + contraseña** para todos. Muchos entran desde el celular de la empresa y no quieren dejar ahí su cuenta personal de Google o Apple.
- **Google y Apple son opcionales:** cada usuario los vincula desde **Configuración**, estando dentro. El login solo acepta una cuenta de Google o Apple ya vinculada (por su `sub`). Sin vinculación automática por correo, sin autorregistro.
- **Contraseña olvidada:** "Olvidé mi contraseña" envía un enlace al correo para definir una nueva.
- **Primer ingreso sin fricción:** el admin asigna la contraseña inicial (como hoy) y el cliente entra y compra de inmediato. Después se le sugiere cambiarla por seguridad, con un aviso **no bloqueante**: nunca se interpone antes de la primera compra.
- **Admin notificado:** equipo Diem (lista configurable en base de datos) y dueño o administrador de la empresa compradora.
- **Correos al comprador:** pedido recibido, pedido listo y requiere atención.
- **Activaciones QR:** comparten los mismos avisos que la compra de códigos.
- **Los códigos no viajan en el correo:** el correo enlaza a la orden, detrás del login. Un correo reenviado o filtrado no expone los códigos.

## Fase 1 — Correcciones de acceso (diem-sas, independiente)
1. **Email normalizado** (`trim` + minúsculas):
   - en login, creación y edición de usuarios;
   - migración que normaliza los existentes (hoy solo cuentas del equipo y de prueba), verificando antes que no haya colisiones;
   - campo de email con `autoCapitalize="none"` e `inputMode="email"`.
2. **`callbackUrl` respetado** al iniciar sesión. Solo rutas internas (`/…`), nunca URLs externas (open redirect).
3. **Límite de intentos** por email e IP en login y en "Olvidé mi contraseña":
   - tabla de intentos en base de datos (sin Redis);
   - respuesta y tiempo constantes para no revelar qué correos existen.

## Fase 2 — Envío transaccional (diem-ai + diem-sas)
Habilita la recuperación de contraseña, el correo de bienvenida y los avisos de pedidos. Sigue el contrato de fuentes ya construido (`docs/CONEXIONES_FUENTES.md` en diem-ai).

**diem-ai**
- `SourceConnection` para diem-sas (tenant Vercode), scope de envío transaccional; la key `dk_live_…` va como secreto en diem-sas.
- **Procesador de `SourceEvent`:**
  - procesa al aceptar (`BackgroundTasks`), con barrido de respaldo `POST /api/sources/process-pending` por el cron de Render que ya dispara `dispatch-due`;
  - `FOR UPDATE SKIP LOCKED`, backoff y estado `dead` tras N intentos.
- **Eventos v1:**
  - `auth.welcome` (opcional) y `auth.password_reset`;
  - `order.received`, `order.ready` y `order.action_required` (compra de códigos y activación QR);
  - `order.received_admin` para el equipo y el dueño.
- **Contenido determinista, sin LLM:** plantillas HTML versionadas en el repo, rellenadas con hechos bloqueados (número de orden, producto, cantidad, total, estado, enlace). Se envían con `BrevoConnector.send_email_html`.
- **Categoría transaccional:** no exige opt-in de marketing (es un mensaje necesario del servicio). Sí respeta rebotes duros y bloqueos de Brevo. Se documenta como excepción explícita a la regla de consentimiento de diem-ai.
- **Trazabilidad:**
  - `WorkflowRun` con `provider_ref` de Brevo por correo;
  - idempotencia por `event_id`: el mismo evento nunca envía dos correos;
  - los eventos de entrega y rebote llegan por el webhook `/webhooks/brevo/events` que ya existe.

**diem-sas**
- **Tabla `NotificationOutbox`** (evento, agregado, payload mínimo, estado, intentos):
  - se escribe **en la misma transacción** que crea o cambia el estado de la orden. Puntos: creación de la compra, compare-and-set a COMPLETED / ACTION_REQUIRED en `purchase-codes.service`, webhook de fulfillment, "Consultar Diem" y activaciones;
  - así no se pierde un aviso ni se envía sin que el cambio exista.
- **Entrega sin cron:**
  - justo después del commit, con `after()` de Next;
  - con un vaciado oportunista en requests del portal (mismo patrón que las recargas pendientes);
  - con un endpoint manual de reintento para operación;
  - cuando diem-ai responde 202, los reintentos de envío son suyos.
- **Destinatarios:**
  - comprador: `CodePurchase.user`, o quien activó la tarjeta;
  - dueño o admin de la empresa: OWNER / GENERAL_ADMIN activos;
  - equipo Diem: lista en `SystemConfig`, no en variables de entorno.

## Fase 3 — Contraseña inicial, cambio sugerido y recuperación (diem-sas)
- **Contraseña inicial asignada por el admin** (como hoy):
  - botón "Generar contraseña" en `user-form.tsx`: segura y fácil de dictar (p. ej. `Mango-Rio-4827`), en lugar de claves débiles;
  - campo `User.mustChangePassword`: `true` cuando el admin asigna o restablece la clave, `false` cuando el usuario la cambia;
  - correo de bienvenida opcional con el enlace al portal, sin la contraseña.
- **Cambio sugerido, nunca obligatorio:**
  - con `mustChangePassword`, un aviso discreto en el portal: "Por seguridad, cambia la contraseña que te asignamos" → Configuración;
  - se puede cerrar y vuelve en la siguiente sesión hasta que la cambie;
  - no aparece en medio de la compra ni la bloquea.
- **Configuración → Contraseña:** cambiar la clave pidiendo la actual; requisitos visibles, mostrar/ocultar y `autocomplete="new-password"`, para que el gestor de contraseñas del teléfono la guarde.
- **"Olvidé mi contraseña":**
  - tabla `PasswordToken` (hash del token, vence en 30 min, un solo uso);
  - en el login: se escribe el correo y llega un enlace para crear una clave nueva;
  - mismo mensaje exista o no el correo (no revela quién tiene cuenta);
  - máximo 3 envíos cada 15 minutos por correo;
  - al cambiar la clave se cierran las demás sesiones.

## Fase 4 — Google y Apple (diem-sas)
- **Tabla `UserIdentity`** (`provider`, `providerAccountId` = `sub`, `userId`, email, fecha), con único `(provider, sub)`.
- **Vincular (Configuración → Inicio de sesión):**
  - estando dentro, "Vincular Google" o "Vincular Apple" abre el flujo del proveedor y guarda su `sub` en el usuario actual;
  - no importa si el correo de Google/Apple es distinto, así que "Ocultar mi correo" de Apple funciona sin casos especiales;
  - se puede desvincular cuando se quiera; la contraseña siempre queda.
- **Al entrar con Google o Apple:**
  - solo se acepta si ese `sub` ya está vinculado a un usuario activo;
  - si no, el mensaje es "Esta cuenta de Google no está vinculada. Entra con tu correo y vincúlala desde Configuración".
- **Google:** `GoogleProvider` de NextAuth v4; exige `email_verified`.
- **Apple:**
  - `AppleProvider`. Como la vinculación es por `sub`, no depende del correo que Apple entregue.
  - El *client secret* de Apple es un JWT que vence a los 6 meses: se genera en el servidor a partir de la llave `.p8` (secreto), para no tener que rotarlo a mano.
  - Riesgo conocido: Apple responde con `form_post` entre sitios y NextAuth v4 puede perder las cookies `state`/`pkce` con `SameSite=Lax`. Se configuran esas cookies con `SameSite=None; Secure` y se prueba en Safari iOS antes de liberar.
- **Celulares compartidos:** quien entra desde el teléfono de la empresa simplemente no vincula nada. "Cerrar sesión" queda visible en el menú.
- **Botones:** "Continuar con Apple" según las guías de Apple (negro/blanco, tamaño mínimo) y "Continuar con Google" según su guía de marca.

## Fase 5 — Responsive y cierre de la experiencia (diem-sas)
- **Login:**
  - correo y contraseña arriba (`autoCapitalize="none"`, mostrar/ocultar clave, "Olvidé mi contraseña");
  - debajo, "Continuar con Google" / "Continuar con Apple" para quien ya los vinculó;
  - estados de carga en cada botón;
  - errores claros.
- **Orden (`/codes/purchases/[id]`):**
  - el título no se corta en celular;
  - "Copiar códigos" fijo abajo en móvil;
  - copiar con confirmación real (mismo arreglo que en "Mis solicitudes");
  - estado en vivo mientras espera stock.
- **Compra:** revisión a 360 px y 390 px (lo grueso quedó en `FASE_UX_FEEDBACK_PORTAL_2026-10.md`).
- **Prueba en dispositivo real:** Safari iOS y Chrome Android, cubriendo login con cada método, compra, enlace del correo con sesión expirada → orden.

## Orden y dependencias
1. Fase 1 (sin dependencias).
2. Fase 2 (base de envío).
3. Fase 3. El cambio sugerido y "Generar contraseña" no dependen de nada; la recuperación por correo depende de la Fase 2.
4. Fase 4: Google primero; Apple cuando estén las credenciales.
5. Fase 5 en paralelo desde la Fase 1.
6. **Lanzamiento a clientes:** invitar por empresa, empezando por un cliente piloto.

## Lo que necesitas preparar (José)
- **Google Cloud:**
  - cliente OAuth web;
  - pantalla de consentimiento publicada;
  - URIs de redirección de producción (`https://<dominio>/api/auth/callback/google`) y de pruebas.
- **Apple Developer Program:**
  - Team ID, App ID y Services ID;
  - llave de *Sign in with Apple* (`.p8`, Key ID);
  - dominio verificado y URL de retorno `https://<dominio>/api/auth/callback/apple`.
- **Brevo:**
  - dominio remitente de Vercode verificado (SPF/DKIM/DMARC), para que los códigos no caigan en spam.
- **diem-ai:**
  - tenant para Vercode/diem-sas;
  - cron de Render para `process-pending`.
- **Lista de correos del equipo Diem** que reciben avisos de pedido.

## Pruebas
- **Unitarias (lógica pura):** normalización de email, `callbackUrl` seguro, vinculación por `sub` (no se entra con una cuenta no vinculada), token de recuperación (hash, vencimiento, un solo uso), `mustChangePassword` (se activa al asignar y se apaga al cambiar), elección de destinatarios y armado de eventos del outbox.
- **diem-ai:** procesador idempotente (el mismo `event_id` no envía dos veces), reintentos y `dead`, plantillas con hechos bloqueados.
- **Manuales en dispositivo:** la matriz de la Fase 5.

## Pendiente de decidir
- Si se agrega "Vincular Microsoft", útil si muchos usan Hotmail/Outlook.
