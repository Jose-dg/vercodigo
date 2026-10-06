# Compra de códigos: checkout descriptivo y detalle de orden (oct 2026)

## Hecho
- **Checkout** (`CheckoutPanel`): después de elegir región y marca (y producto, si la marca tiene varios), una pantalla de dos columnas. A la izquierda, la lista de denominaciones con su precio (con buscador si hay más de 6). A la derecha, "Tu orden": nota de región, cantidad, stock, denominación, precio por unidad, saldo de la wallet y total animado. Plataforma: empresa + origen (sede **o** número, excluyentes).
- **Detalle de orden** `/codes/purchases/[id]`: cabecera con estado, referencia, fecha y solicitante; barra de progreso animada Creada → Procesando → Completada; "Qué se pidió", "Cálculo", "Movimientos de wallet", códigos entregados e "Historial de estados". Consulta el estado cada 3 s mientras la orden no termina. Botón "Reintentar/Consultar Diem" cuando aplica.
- Tras comprar, redirige al detalle. El historial tiene un botón "Detalle" y el enlace de vuelta abre la pestaña de historial.
- Backend solo de lectura: `getCodePurchaseForUser` añade marca/categoría, `unitPrice`, `walletTransactions` y `timeline`.
- `src/lib/codes/purchase-timeline.ts` es una función pura y tiene pruebas (`tests/purchase-timeline.test.mjs`, incluidas en `test:devdiem`).

## Limitaciones conocidas
- El historial es **derivado**: solo `createdAt`, `completedAt` y el estado actual. Los estados intermedios (esperando stock, revisión) no tienen hora propia.
- El aviso de saldo insuficiente solo aparece si la moneda del precio coincide con la de la wallet.

## Siguiente
- Tabla `CodePurchaseEvent` (con migración) para tener la hora de cada transición, alimentada desde `processCodePurchase` y el webhook.
- Corregir `tests/catalog-regions.test.mjs:101`. Falla desde `2cf83ba`: el test espera tope 0 sin stock, pero ahora el tope es 100.
- Probar el flujo completo con datos reales (OWNER y SUPER_ADMIN) en móvil y en escritorio.
