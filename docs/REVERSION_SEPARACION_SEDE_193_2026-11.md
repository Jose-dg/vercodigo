# Reversión segura de la separación de la sede 193

## Objetivo

Volver a asociar la sede `cmj1ogatk0001dcr9ggd74svg` a **Laboratorio Clínica del Play**, junto con las seis compras y movimientos que fueron trasladados a **Tatiana** el 8 de noviembre de 2026.

Esto es una reasignación de datos existentes, no un cambio de estructura. No modifica `schema.prisma`, no crea migraciones y no ejecuta SQL de escritura manual. Las escrituras se hacen con Prisma dentro de una transacción serializable.

## Controles

`ops:reverse-store-split` solo puede revertir una separación que tenga el recibo generado por `ops:split-store`:

- exige que sean exactamente la sede, las compras y activaciones del recibo original;
- permite reversos posteriores únicamente cuando cuelgan de uno de los movimientos originales;
- bloquea compras en vuelo, usuarios, números, teléfonos autorizados o facturas ligados a la sede;
- bloquea movimientos incluidos en estados de cuenta, periodos cerrados y saldos iniciales incompatibles;
- concilia cada entrega: exige todos los códigos entregados, `diemRequestId` y exactamente un consumo `CONFIRMED` por el mismo total y moneda;
- rechaza consumos `PENDING` o `FAILED`; una entrega no se considera cobrada hasta que el débito afectó realmente el saldo;
- para compras `REVERSED`, exige un único reembolso confirmado por el valor completo del consumo;
- impide que un consumo quede oculto dentro del saldo de apertura del próximo estado de cuenta del Laboratorio;
- verifica moneda y consistencia de ambas wallets antes de escribir;
- vuelve a calcular ambos ledgers y registra `AuditLog` con acción `STORE_SPLIT_REVERSED`;
- conserva la empresa y wallet de Tatiana para revisión; no elimina ni desactiva datos.

Las tarjetas no necesitan actualización individual: conservan su `storeId` y siguen a la sede. En cambio, `CodePurchase.companyId` y `WalletTransaction.walletId` sí se reasignan explícitamente porque guardan su dueño directamente.

## Runbook

El recibo privado original `.secure/split-palacio-193/receipt.json` es obligatorio. Si no está disponible en el entorno de operación, debe recuperarse de su almacenamiento seguro; no debe reconstruirse a mano.

```bash
# 1. Solo lectura. Genera un segundo recibo con el estado exacto de ambas wallets.
npm run ops:reverse-store-split -- plan \
  --split-receipt .secure/split-palacio-193/receipt.json \
  --actor-user cmixxhiad00092fwzu5gsb6gy \
  --store-name "Laboratorio Clínica del Play 193" \
  --store-address "Palacio Nacional Local 193" \
  --out .secure/rejoin-palacio-193

# 2. Revisar: 6 compras, los movimientos esperados y los saldos antes/después.
# Aplicar solamente cuando el plan coincida con producción.
npm run ops:reverse-store-split -- apply \
  --receipt .secure/rejoin-palacio-193/receipt.json \
  --expected-database diemsas_zsft

# 3. Verificación global del ledger.
npm run wallet:verify
```

El recibo del plan incluye una sección `billing` sin códigos ni PIN: identifica el consumo confirmado de cada compra, su valor, cualquier reembolso y los movimientos que deben salir como líneas individuales en el siguiente estado de cuenta.

El `apply` toma el mismo lock contable que usa la emisión de estados de cuenta para ambas wallets, recalcula el plan y la conciliación dentro de la transacción y compara la huella. Por eso no puede cerrarse un estado de cuenta mientras se reasignan movimientos. Si algo cambió desde `plan`, no escribe. Repetir el mismo `apply` después de completarlo devuelve `NO-OP` tras verificar que el historial ya está en el Laboratorio.

## Verificación funcional

Después del `apply`:

1. En el checkout administrativo, seleccionar **Laboratorio Clínica del Play**.
2. Confirmar que aparezca **Laboratorio Clínica del Play 193** como sede.
3. Realizar una compra pequeña y comprobar que el cargo queda en la wallet del Laboratorio y el origen en la sede 193.
4. Previsualizar el siguiente estado de cuenta y confirmar que todos los IDs de `billing.statementChargeMovementIds` aparecen como líneas de consumo; no basta con que estén incorporados en el saldo inicial.
5. Confirmar `STORE_SPLIT_REVERSED` en auditoría y comparar los saldos con el recibo.

La orden histórica en DevDiem ya conserva la cuenta comercial original del Laboratorio, según el registro de la separación. Este comando no reenvía órdenes ni modifica snapshots congelados.
