# Activación de tarjetas en bloque (nov 2026)

## Por qué
Un cliente compra muchas tarjetas físicas y las paga todas juntas. No quiere activarlas una por una en el mostrador: cuando olvida activar alguna, el cliente final le reclama. Diem las activa por él desde la plataforma.

## Qué quedó hecho
- **Pantalla `/cards/activate-bulk`** (solo **SUPER_ADMIN**, en el menú Operations):
  1. Se escanean o pegan hasta 500 códigos QR (o el enlace completo del QR). El campo solo acepta códigos con el formato real: 8 caracteres del alfabeto sin ambiguos, nunca 0, 1, I ni O (`src/lib/cards/card-uuid.ts`, la misma regla que usa el generador). Mientras se escribe, un contador muestra cuántos QR se van a activar, cuántos son inválidos (listados, con botón "Quitar inválidos") y cuántos repetidos, que se cuentan una sola vez. No deja validar si hay inválidos o si pasa de 500. Editar la lista anula la validación anterior, así que se activa exactamente lo que se mostró.
  2. Al validar se muestra, por tarjeta, si está lista o el motivo del bloqueo (ya activada, en proceso, sin costo, producto sin mapear, tienda o producto inactivo) y las no encontradas.
  3. Por empresa se muestra el total a cobrar, el saldo de la billetera y el saldo que quedaría. Si queda en deuda, aparece un aviso en rojo; no se bloquea, igual que en el resto del sistema.
  4. Antes de activar, un diálogo recuerda que una tarjeta activada muestra su código a quien escanee el QR.
  5. Se procesa en tandas de 10 con barra de progreso y el resultado se descarga en CSV.
- **API:** `POST /api/cards/activate-bulk/preview` y `POST /api/cards/activate-bulk` (una tanda por llamada). Cada tanda deja un `AuditLog` `CARD_BULK_ACTIVATE`.
- **Servicio:** `src/services/self-service/bulk-activate-cards.service.ts`. Reutiliza el mismo núcleo que la activación por QR (`startCardActivation` en `activate-card.service.ts`): mismo lock, mismo `ActivationJob`, misma liquidación y mismo débito. No se duplicó lógica de cobro.
- **Remisión de tarjetas** (`/cards/reassign`) ya existía; ahora aparece en el menú Operations para la plataforma.

## Decisiones
- **Tandas de 10:** cada tarjeta implica una llamada síncrona a Diem, y 10 caben en el límite de 60 s de cualquier plan de Vercel. Si una tanda falla, se vuelve a validar y se continúa: las ya activadas o en proceso se omiten, nunca se cobran dos veces.
- **Precio congelado por tarjeta:** cada tarjeta viaja con el valor que se mostró al validar. Si la tarifa cambió entre la validación y la activación, esa tarjeta se rechaza ("La tarifa cambió") en lugar de cobrar otro valor.
- **Límite por usuario:** el límite del flujo QR (10/min, 100/h, 500/día) no aplica aquí. Los topes son 500 por validación, 10 por tanda y el acceso solo para plataforma.
- **Formato validado también en el servidor:** las dos rutas rechazan todo el lote si trae un código mal formado, aunque alguien llame la API sin pasar por la pantalla.
- **Sin avisos por tarjeta:** no se envía un aviso por tarjeta, para no mandar cientos de mensajes. La constancia para el cliente es el CSV.
- **Sin stock en Diem:** la tarjeta queda `AWAITING_STOCK` sin débito y sigue el flujo actual de Reintentar en Activaciones.

- **Quién puede (decisión de José, 11-nov): solo SUPER_ADMIN**, tanto para activar en bloque como para la remisión. SYSTEM_ADMIN tiene negado activar tarjetas y no tiene `manage all`. Antes veía los dos enlaces y la API le respondía 403. Ahora el permiso de cada operación vive en `CARD_BULK_OPERATIONS` (`src/lib/auth/abilities.ts`) y lo leen la API (`withAuth`), el sidebar y la página. `tests/card-bulk-access.test.mjs` (`npm run test:access`) recorre todos los roles y falla si el menú y la API se separan.

## Cómo operarlo con el cliente
1. Confirmar por escrito que el cliente acepta tener las tarjetas activas: si se pierden o se las roban, se pueden canjear.
2. Registrar el pago o recarga en su billetera.
3. Mover las tarjetas a la sede correcta en Remisión de tarjetas. Una tarjeta activada ya no se puede mover, y la activación queda atribuida a la sede que tenga en ese momento.
4. Confirmar que Diem tiene stock de esa denominación.
5. Activar en bloque, descargar el CSV y enviárselo al cliente.

## Verificación
- `tests/integration/bulk-activation.test.ts` (dentro de `npm run test:concurrency`) cubre:
  - la vista previa con tarjetas mezcladas y la proyección de saldo;
  - que solo se activan las elegibles y se debita una vez cada una;
  - que reenviar la misma tanda no duplica nada;
  - que el contador de rate limit queda intacto;
  - el rechazo por cambio de tarifa;
  - el caso sin stock;
  - el tope de la tanda;
  - el rechazo de códigos mal formados y la aceptación del enlace del QR.
- `tests/card-uuid.test.mjs` (dentro de `npm run test:qr`) cubre el parser: formato, mayúsculas, repetidos, enlaces e inválidos.
- Suite de integración completa: 71/71. `tsc` y el lint de los archivos tocados quedaron limpios. El build se hizo en una copia aislada.

## Pendiente
- Probar en el navegador con un usuario de plataforma.
- Deploy. No requiere migraciones.
- Fuera de alcance, para revisar: `reassignCardsToStore` permite mover tarjetas a una sede de **otra empresa**.
