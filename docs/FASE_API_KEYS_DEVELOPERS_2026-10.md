# Fase 2 — API keys por empresa, API v1 y portal de desarrolladores (oct 2026)

## Qué se resolvió

Una empresa ya puede disparar entregas **desde su propio sistema**:

1. Crea una API key en el portal.
2. Consulta el catálogo con su precio.
3. Crea una entrega (compra con cargo a su billetera + email con los códigos a su cliente).
4. Consulta el estado.

La documentación vive en `/developers`, por ahora con sesión, en un layout basado en el bloque `sidebar-03` de shadcn.

## Decisiones

- **La key la genera diem-sas.** La API vive aquí porque precio, billetera, permisos y empresas viven aquí. DevDiem sigue viendo un solo service account; las keys de las empresas nunca le llegan.
- **Se guarda solo el hash.** `CompanyApiKey.keyHash` = `HMAC-SHA256(API_KEY_PEPPER, key)`. Es el mismo esquema que los service accounts de DevDiem (`apps/tenancy/service_accounts.py`).
- **La key en claro la custodia la empresa.** Se muestra una sola vez y nadie en Diem puede recuperarla.
- **Quién la crea:** OWNER o GENERAL_ADMIN de la empresa. La key **actúa en nombre de quien la creó** (su rol y su origen de compra) y deja de servir si esa persona se desactiva o deja de ser administradora.
- **Las keys son solo de su empresa.** Únicamente su OWNER y sus GENERAL_ADMIN las ven y las gestionan. **La plataforma no tiene acceso** (`canManageApiKeys`), ni siquiera para listarlas. Esto se corrigió después de la primera revisión: la versión inicial le daba a la plataforma un selector con todas las compañías.
- **Dos ambientes:**
  - `vck_test_` (**sandbox**): mismas rutas y validaciones (producto, precio real, `expected_unit_price`, idempotencia, scopes, límites), pero **no cobra, no pide códigos a Diem y no envía emails**. Las entregas van a la tabla `SandboxDelivery`, nunca aparecen en "Mis solicitudes" y el saldo que devuelve es ficticio.
  - `vck_live_` (**producción**): consume saldo real. Crearla exige confirmar "Entiendo que consume saldo real".
  - Por defecto se crea sandbox. El límite es de 5 activas por ambiente, y cada ambiente solo lee sus propias entregas.
  - El resultado de sandbox se elige con una etiqueta en el email del destinatario: `+fail`, `+stock` o `+review`.
  - Todas las respuestas incluyen `livemode`.
- **Sin webhooks por ahora:** se quitaron de la documentación para no anunciar algo que no existe.
- **La API no devuelve códigos.** La entrega es por email. Una key filtrada no permite sacar PINs.
- **Formato:** `vck_live_<12 hex>_<32 bytes base64url>`. El prefijo es público.

## Cambios (rama `feat/code-delivery-end-customer`)

- **Datos:**
  - Migración `20261022120000_company_api_keys`: enum `ApiKeyEnvironment` y tablas `CompanyApiKey`, `ApiRateWindow` y `SandboxDelivery`.
  - CHECK de revocación consistente y al menos un scope por key.
- **Dominio** `src/modules/api-keys/domain.ts`: generar, parsear, hashear, comparar con `timingSafeEqual` y validar scopes.
- **Servicio** `src/modules/api-keys/service.ts`:
  - Crear, en una transacción con `FOR UPDATE` sobre la empresa, con máximo 5 activas y auditoría `API_KEY_CREATED`.
  - Listar sin hash.
  - Revocar, idempotente, con auditoría `API_KEY_REVOKED`.
  - Autenticar, con el mismo error genérico para cualquier fallo.
  - Rate limit de 60 req/min por key en Postgres, compartido entre instancias.
- **Guard** `src/lib/auth/api-key-guard.ts` (`withApiKey(scope, handler)`): 401, 403 o 429 con `Retry-After`.
- **CASL:** nuevo sujeto `ApiKey`.
- **Rutas de gestión** (sesión): `GET/POST /api/api-keys` y `DELETE /api/api-keys/[id]`.
- **API v1:**
  - `GET /api/v1/catalog`
  - `POST /api/v1/deliveries` (`Idempotency-Key` obligatorio; `expected_unit_price` opcional para no cobrar si el precio cambió)
  - `GET /api/v1/deliveries/{id}`
  - `GET /api/v1/wallet`
- **Trazabilidad:** las compras hechas por API llevan `metadata.channel = "api"` y `api_key_prefix` en el comando congelado que va a Diem.
- **Frontend:**
  - `src/app/(developers)/developers/**`: layout propio (sidebar-03 portado a `src/components/developers/developers-sidebar.tsx`, sin tocar `components/ui`).
  - Páginas de documentación con ejemplos en curl, Node y Python.
  - `/developers/api-keys`: crear, mostrar la key una sola vez con confirmación "Ya la guardé", y revocar.
  - Ítem "Desarrolladores" en el sidebar del portal; se eliminó el grupo "Documentation" que venía de la plantilla.

## Bug encontrado en el camino

En SQL crudo, un parámetro `Date` contra una columna `timestamp(3)` se convertía con la zona horaria de la sesión (Bogotá, −5 h), mientras Prisma guarda en UTC. Por eso la limpieza de ventanas viejas borraba la del minuto en curso y el límite nunca se activaba. Se corrigió fijando UTC en la consulta (`AT TIME ZONE 'UTC'`), y un test lo cubre.

## Verificación

- `tests/api-keys.test.mjs` (8 tests, incluidos los ambientes y los escenarios sandbox): formato, hash con pepper, key alterada, scopes, catálogo, y que el serializador **nunca** incluya códigos.
- `tests/integration/api-keys.test.ts` (7 tests), contra las rutas reales. Además de lo de abajo, cubre que una key sandbox no genere `CodePurchase`, movimiento de billetera ni llamada a Diem, y que la plataforma u otra empresa no puedan ver ni revocar keys ajenas:
  - revocar → 401
  - permiso faltante → 403
  - límite de 5 keys activas
  - entrega idempotente que se envía por email al destinatario
  - aislamiento entre empresas (404)
  - creador desactivado → 401
  - la plataforma no puede crear keys
  - rate limit
- Totales: `test:concurrency` 50/50, `test:devdiem` 56/56, `test:access` 7/7.
- Typecheck y lint limpios en los archivos nuevos. `abilities.ts` mantiene sus `as any` previos.
- `next build` OK, compilado en una copia aislada.
- **Pendiente:** revisión visual en el navegador con sesión (crear key → curl → revocar).

## Antes de producción

1. `API_KEY_PEPPER` en Vercel (32+ caracteres aleatorios, por ejemplo `openssl rand -base64 48`). Si cambia, todas las keys dejan de servir.
2. Aplicar la migración en prod.
3. Lo de la Fase 1: deploy de DevDiem `a4f753f` y marca de email configurada.

## Lo que sigue

- Documentación pública (sacar `/developers` del login, salvo `/developers/api-keys`).
- Keys de prueba (`vck_test_`) contra un sandbox sin cobro.
- Envío masivo (lote de destinatarios en una sola llamada).
