# Diem-SAS → Diem Fulfillment

La integración utiliza la API partner de Fulfillment. El webhook legacy de
marketplaces y el stock local de `Key` ya no participan en compras nuevas.

## Variables solo de servidor

- `DIEM_API_URL=https://diem-ai.onrender.com`
- `DIEM_SERVICE_API_KEY=<key de diem-sas-production>`
- `DIEM_STORE_ID=<uuid de la tienda autorizada>`
- `CRON_SECRET=<secreto independiente>`

No existe fallback automático para `DIEM_API_URL`: si falta una variable, la
compra falla antes de contactar un servidor. En producción la URL debe usar
HTTPS; HTTP solo se admite para `localhost` y `127.0.0.1`.

## Migración

La migración
`prisma/migrations/20260727010000_devdiem_fulfillment_saga/migration.sql`
está preparada, pero debe aplicarse mediante el procedimiento controlado de
producción. No usar `prisma db push`.

Después de migrar, configurar en Productos:

- `Product.devDiemProductId` para productos sin denominaciones.
- `ProductDenomination.devDiemProductId` para cada denominación.

Los valores son UUID `product_id` del catálogo partner, no SKU.

## Compras

La compra se crea `PENDING`, solicita Fulfillment con idempotencia y puede pasar
por `AWAITING_STOCK`. Los códigos se revelan desde Diem y la wallet se debita
solo al completar. Un fallo terminal no genera débito.

El navegador envía un `Idempotency-Key` estable durante cada intento. Repetir
el mismo POST con los mismos datos devuelve la misma compra; reutilizar la
clave con otro producto, denominación, tienda o cantidad devuelve conflicto.
Una compra sin costo configurado solo usa el valor nominal de su denominación
como fallback. Si tampoco existe un valor nominal positivo, se rechaza antes
de pedir códigos a Diem.

`ACTION_REQUIRED` y `FAILED` detienen el sondeo de la pantalla y no se presentan
como compras exitosas.

## Tarjetas físicas

La activación crea un `ActivationJob`, bloquea la tarjeta y solicita el código
con source `physical_card`. La tarjeta se marca activada, se enlaza el código y
se debita la wallet dentro de una única transacción local solamente después del
revelado exitoso.

## Worker

Programar cada minuto:

`POST /api/jobs/fulfillment`

con `Authorization: Bearer <CRON_SECRET>`. Procesa compras y activaciones
pendientes con reintentos idempotentes.

## Preflight protegido

Antes de habilitar compras, ejecutar:

```bash
curl --fail --show-error \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://<dominio-diem-sas>/api/jobs/fulfillment
```

El endpoint hace únicamente lecturas y comprueba:

- formato y presencia de las variables de Diem;
- autenticación, grant de tienda y acceso al catálogo partner;
- existencia de productos remotos habilitados;
- mapeo de cada producto o denominación activa de Diem-SAS.

Solo continuar si responde HTTP 200 con `"ok": true`.

## Orden de activación

1. Aplicar `0009_partnercheckoutintent` en Diem mediante el procedimiento
   controlado del backend.
2. Crear la cuenta de servicio de Diem-SAS, el grant de tienda y los scopes
   `catalog:read`, `code_requests:create`, `code_requests:read` y
   `code_requests:codes:reveal`.
3. Confirmar que la tienda tiene activo `code_fulfillment_api` y que el gate
   global de partner reveal está habilitado.
4. Aplicar la migración Prisma de la saga en Diem-SAS.
5. Configurar las cuatro variables y mapear los UUID de catálogo.
6. Ejecutar el preflight protegido.
7. Probar un producto de bajo valor y confirmar solicitud, revelado, débito
   único y replay idempotente.
8. Activar el cron por minuto.

### Provisionamiento en Diem

Sustituir los placeholders y ejecutar mediante el procedimiento controlado del
backend. `--expected-database` evita operar sobre una base equivocada:

```bash
python manage.py fulfillment_partner create-account \
  --expected-database <nombre-db-diem> \
  --client-slug diem-sas-production \
  --name "Diem SAS Production"

python manage.py fulfillment_partner grant-store \
  --expected-database <nombre-db-diem> \
  --client-slug diem-sas-production \
  --store-id <uuid-tienda-diem> \
  --scopes catalog:read,code_requests:create,code_requests:read,code_requests:codes:reveal

python manage.py fulfillment_partner set-auto-processing \
  --expected-database <nombre-db-diem> \
  --client-slug diem-sas-production \
  --store-id <uuid-tienda-diem> \
  --enabled

python manage.py fulfillment_partner create-key \
  --expected-database <nombre-db-diem> \
  --client-slug diem-sas-production \
  --name "Render production" \
  --show-key
```

La llave se muestra una sola vez. Guardarla directamente como
`DIEM_SERVICE_API_KEY` y no copiarla a documentación ni al repositorio.
