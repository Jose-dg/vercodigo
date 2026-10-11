# Recargas de saldo por Bre-B (Vercode)

**Estado:** implementado en la rama `feat/vercode-wallet-topups`. **No desplegado.**
**Diseño:** `diem/docs/billetera/DIEM_SAS_A_Y_B.md` (camino A) y `diem/docs/adr/0005`, `0006`.

## Qué hace
Un OWNER o GENERAL_ADMIN de una empresa recarga saldo desde la barra superior del portal:

1. **Recargar** → monto (entre $10.000 y $12.110.000, el tope por transferencia de Bre-B) y aceptación de las condiciones.
2. DevDiem crea la recarga y devuelve cómo pagar. Hoy es el **QR estático de Bancolombia** y la llave Bre-B. La pantalla muestra el **monto exacto** y la **referencia `VC-XXXXXXXX`** para la descripción de la transferencia.
3. La empresa transfiere y pulsa **Ya hice la transferencia**, con la referencia que le dio su banco.
4. **Finanzas** confirma el pago en diem-app, contra el extracto.
5. Cuando DevDiem la reporta como acreditada, diem-sas registra el `RECHARGE` en la billetera. Es **una sola vez**, gracias al índice único en `WalletTransaction.gatewayTransactionId`. Después confirma el registro a DevDiem (acuse).

Una recarga dejada en "Pagar más tarde" se puede retomar desde el mismo diálogo.

## Experiencia (UX)
- **Barra superior**: indicador "Disponible" o "Pendiente" (deuda) con color por estado, un punto ámbar si hay recargas en curso y un popover con el detalle, más el botón **Recargar** y el toggle de tema.
- **Indicador de pasos**: Monto → Pago → Confirmación. El foco va al título de cada paso, para lectores de pantalla.
- **Monto**: campo grande con formato de pesos, montos sugeridos y **"Pagar pendiente"** con la deuda exacta redondeada al millar. La **vista previa del saldo** muestra el saldo actual y el que queda después de acreditar, y si cubre todo lo pendiente o una parte. Incluye la sección "¿Cómo funciona?".
- **Pago**: QR (descargable en PNG) y llave. Monto exacto y referencia `VC-…` con botón de copiar. **Cuenta regresiva** del vencimiento, en ámbar cuando faltan menos de 2 h. **"Enviar instrucciones"** usa la hoja de compartir del celular o copia un texto listo para quien hace el pago (por ejemplo, el contador). En el celular, la llave y los datos van antes del QR.
- **Confirmación**: línea de tiempo (creada → pago reportado → verificación de finanzas → acreditada) con fechas y tiempo estimado.
- **Aviso al acreditar**: un toast "Recarga acreditada: +$X" aunque el diálogo esté cerrado.
- **Historial** en `/wallet#recargas`: estado por recarga, con **Continuar pago** o **Ver estado**. Una recarga pendiente también se puede retomar desde el diálogo.
- **Responsive** (celular, con el diálogo desplazable y el indicador de pasos fijo), **modo oscuro** y `prefers-reduced-motion`. Revisado con capturas en escritorio, celular y modo oscuro.

## Quién es dueño de qué
| Hecho | Dueño |
|---|---|
| Cobro, pagador, revisión y confirmación | DevDiem (`/api/v1/stored-value/partner/...`) |
| Saldo de la empresa | diem-sas (`Wallet` / `WalletTransaction`), hasta la Fase 5 |
| Lista de recargas | DevDiem. diem-sas **no guarda copia** y las lee siempre de allí |

## Piezas
- `src/lib/devdiem/stored-value.ts`: cliente de DevDiem (usa la misma configuración y el mismo manejo de errores que el fulfillment).
- `src/services/wallet/gateway-topup.service.ts`: registra en la billetera las recargas acreditadas, de forma idempotente, y envía el acuse.
- `src/app/api/wallet/*`: BFF del portal (resumen de saldo, crear, consultar y reportar recarga).
- `src/app/api/jobs/wallet-topups`: cron de recuperación. Registra las recargas acreditadas que nadie sincronizó. Se protege con `CRON_SECRET`.
- `src/components/wallet/*`: barra superior (saldo o deuda, recargas en curso, Recargar y tema), diálogo de recarga. No se modifica `app-sidebar`.
- `src/lib/wallet/balance.ts`: presentación del saldo, compartida con la página `/wallet`.

## Variables de entorno (Vercel)
| Variable | Ejemplo | Para qué |
|---|---|---|
| `DIEM_STORED_VALUE_CHANNEL` | `vercode-b2b` | Slug del canal de Vercode en DevDiem (tienda "Ver código") |
| `DIEM_TOPUP_PAYMENT_METHOD_ID` | `42` | `PaymentMethod` de DevDiem con `gateway_provider=manual_breb` |
| `DIEM_TOPUP_METHOD_TYPE` | `BRE_B_MANUAL` | Cambia a `BRE_B` cuando haya proveedor con QR dinámico |
| `DIEM_TOPUP_RETURN_URL` | `https://<portal>/wallet` | Debe estar en `STORED_VALUE_RETURN_URL_PREFIXES` de DevDiem |
| `CRON_SECRET` | (ya existe) | Cron `/api/jobs/wallet-topups` cada 10 minutos |

En DevDiem se configuran el service account (`stored_value:topups:create/read`), el `PaymentMethod` con `SIZU_BREB_KEY` y `SIZU_BREB_QR_PAYLOAD` en el entorno, y la `StoredValuePolicy` del canal: `funding_target=partner_wallet`, `allowed_payment_method_types=["BRE_B_MANUAL"]` y TTL de 72 h.

## Gate de activación
La activación en producción requiere el **corte de Vercode a la tienda "Ver código"** (`diem/docs/billetera/CORTE_VERCODE_TIENDA.md`). Activarla sobre la tienda Diem mezclaría las ventas de ambos negocios.

## Pruebas
- `npm run test:wallet-topups` (10): presentación, referencia, validación de monto, recargas en curso, vista previa del saldo, pago de deuda, cuenta regresiva, línea de tiempo e instrucciones.
- Typecheck y `next build` sin errores.
- Pendiente: prueba de punta a punta con DevDiem local y un usuario de empresa.

## Lo que sigue
- **QR dinámico** cuando se cierre el acuerdo con un proveedor. Solo cambia el adaptador en DevDiem y `DIEM_TOPUP_METHOD_TYPE`; la interfaz ya maneja QR y llave.
- **Pantalla de revisión en diem-app** (la API ya existe en DevDiem).
