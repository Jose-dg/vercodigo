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
- `src/components/wallet/*`: barra superior (saldo o deuda, recargas en curso, Recargar y tema), diálogo de recarga. No se modifica `app-sidebar`.
- `src/lib/wallet/balance.ts`: presentación del saldo, compartida con la página `/wallet`.

## Configuración (oct 2026: de 5 variables a 1)
Las variables de entorno quedan solo para secretos e infraestructura.

| Qué | Dónde | Valor |
|---|---|---|
| Canal de Vercode en DevDiem | Constante en `src/lib/devdiem/stored-value.ts` | `vercode-b2b` |
| Medio de cobro | Constante en `stored-value.ts` | `BRE_B_MANUAL` (pasa a `BRE_B` con el proveedor de QR dinámico) |
| URL de retorno tras pagar | Se calcula del portal que hace la solicitud | `<origen>/wallet` (debe estar en `return_url_prefixes` del canal en DevDiem) |
| Prefijo de la cuenta comercial | Constante en `src/lib/devdiem/fulfillment.ts` | `diem-sas` (cuentas `diem-sas:<companyId>`; no se puede cambiar sin desvincular las existentes) |
| Recargas habilitadas | Base de datos: `SystemConfig WALLET_TOPUPS_ENABLED` | `'true'` para activarlas; si no existe, apagadas (no se ofrece el botón y el cierre de estados de cuenta no consulta DevDiem) |
| `DIEM_TOPUP_PAYMENT_METHOD_ID` | Variable de entorno (**transitoria**) | `PaymentMethod` de DevDiem con `gateway_provider=manual_breb`. Se elimina cuando DevDiem resuelva el medio desde la política del canal |
| `CRON_SECRET` | Variable de entorno (secreto, ya existía) | Protege `GET /api/jobs/fulfillment`; no activa ni recupera recargas |

Para activar las recargas:

```sql
INSERT INTO "SystemConfig"(id, key, value, "updatedAt")
VALUES ('wallet-topups-enabled', 'WALLET_TOPUPS_ENABLED', 'true', now())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, "updatedAt" = now();
```

En DevDiem se ejecuta `configure_vercode_breb` después del corte. El comando conserva los scopes existentes, agrega `stored_value:topups:create/read`, configura el webhook y crea el `PaymentMethod` y la `StoredValuePolicy` (`partner_wallet`, `BRE_B_MANUAL`, TTL 72 h, sin exigir identidad verificada). La llave pública vive en `PaymentMethod.display_key`; el payload EMV de `display_qr_payload` es opcional y puede agregarse después. No son secretos ni variables de entorno.

No existe `/api/jobs/wallet-topups`. La entrega inmediata llega por el webhook firmado; el cierre de estados de cuenta sincroniza créditos pendientes como red de recuperación. DevDiem monitorea créditos sin acuse con `commercial_core_health --strict`.

## Gate de activación
La activación en producción requiere el **corte de Vercode a la tienda "Ver código"** (`diem/docs/billetera/CORTE_VERCODE_TIENDA.md`). Activarla sobre la tienda Diem mezclaría las ventas de ambos negocios.

## Pruebas
- `npm run test:wallet-topups` (10): presentación, referencia, validación de monto, recargas en curso, vista previa del saldo, pago de deuda, cuenta regresiva, línea de tiempo e instrucciones.
- Typecheck y `next build` sin errores.
- Pendiente: prueba de punta a punta con DevDiem local y un usuario de empresa.

## Lo que sigue
- **QR dinámico** cuando se cierre el acuerdo con un proveedor. Solo cambia el adaptador en DevDiem y la constante del medio de cobro; la interfaz ya maneja QR y llave.
- **Pantalla de revisión en diem-app** (la API ya existe en DevDiem).
