# API DevDiem (empresa proveedora de códigos) — referencia externa

Documentación de la API externa de **DevDiem**, la empresa proveedora de códigos digitales de la que Diem SAS obtiene inventario (Netflix, Xbox, tarjetas regalo, etc.). Este es el sistema al que Diem SAS debe llamar cuando necesita solicitar códigos que no tiene disponibles localmente en `Key` (estado `AVAILABLE`).

No es documentación de este repo — es la referencia del backend externo (Django REST Framework) que consumimos como cliente.

## Base URL
`https://api.devdiem.com/` (reemplazar según entorno)

## Auth
Simple JWT. `POST /api/token/` o `POST /api/auth/login-email/` → `{access, refresh}`. El `access` expira en 60 minutos; refrescar con `POST /api/token/refresh/`. Los endpoints de órdenes (`/api/orders/...` y `/marketplaces/webhook/order/create/`) son hoy `AllowAny` en el backend de DevDiem (sin JWT obligatorio), pero se recomienda enviarlo igual para trazabilidad de `registered_by`.

## Flujo manual de 4 pasos (crear orden desde frontend)
```
[1] POST /api/orders/create/                        → obtiene id_order
[2] POST /api/orders/assign-payment/<id_order>/
[3] POST /api/orders/assign-products/<id_order>/
[4] POST /api/orders/send/<id_order>                 → retorna los códigos únicos (UniqueCode)
```
- Los códigos (`delivered_products[].code`) **solo se devuelven en la respuesta del Paso 4**. `GET /api/orders/<id>/` nunca los incluye — hay que capturarlos ahí mismo.
- Paso 4 es idempotente (se puede reintentar sin duplicar entregas) y puede devolver `200` (entrega completa) o `206` (entrega parcial, falta stock — hay que recargar inventario en DevDiem y reintentar).
- `products_with_quantity[].sku` debe existir exactamente igual en DevDiem.

## Integración automática vía webhook (Shopify-style, sin los 4 pasos)
`POST /marketplaces/webhook/order/create/` — un solo request con `name` (idempotencia por `order_code`), `store_id`, `customer`, `billing_address` (usa `.company` como número de documento — no enviar "N/A"/"NULL"), `line_items[].sku/quantity/price`. Internamente crea cliente+orden+pago+productos y entrega códigos si hay stock, todo en un solo paso.
- Idempotente por `name` — mismo pago/checkout debe reusar el mismo `name` siempre, nunca timestamps aleatorios.
- Si falta inventario en DevDiem, la orden queda `pending`, no se envía email, responde `201` igual (no hay señal de error, solo hay que revisar el estado para saber si se completó).
- Sin auth server-to-server obligatoria hoy — DevDiem recomienda no exponerlo directo al navegador, solo backend-a-backend.
- Método de pago está hardcodeado internamente (ID 6) del lado de DevDiem — no configurable desde el payload.

## Listado optimizado de órdenes
`GET /api/orders/list/?page=N&page_size=M` (paginado, `OrderListSerializer` ligero — sin `payment_methods`, sin campos completos). `GET /api/orders/<id>/` para el detalle completo sin paginar.

## Estados relevantes
- `Order.state`: `pending` · `completed` · `delivered` · `to_solve` · `preorder`.
- `OrderProduct.state_product`: `pending` · `add` (entrega completa) · `to_solve`.
- `UniqueCode.state`: `available` → `delivered` al entregarse.

## Notas para cuando Diem SAS integre esto
- Hace falta mapear `Product.sku` (nuestro) ↔ `sku` de DevDiem, y `Store` (nuestra) ↔ `store_id` UUID de DevDiem.
- `MATRIX_API_URL`/`MATRIX_API_KEY` ya existen en `.env.local` mencionando "empresa matriz" — verificar si apuntan a este mismo DevDiem o son de un intento anterior con otra forma de API (esta doc no calza con un endpoint simple de "pins", es un flujo de órdenes completo).
