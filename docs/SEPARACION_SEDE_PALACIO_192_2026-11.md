# Separación de la sede Palacio Nacional 192 del Laboratorio Clínica del Play (nov 2026)

## Por qué

El local del centro, Palacio Nacional 192 (sede `A534FR`, id `cmj1ogatk0001dcr9ggd74svg`), dejó de pertenecer al Laboratorio Clínica del Play (`cmixxheof00002fwzos7ixow9`). Sus compras se debitaban de la wallet del Lab, así que el Lab veía movimientos que no le correspondían.

Decisión comercial (José, 7-nov-2026):

- el 192 pasa a ser una **empresa propia con wallet propia**;
- su **historial se mueve** con él;
- se atribuye por **sede** (`CodePurchase.storeId`, `CardActivation.storeId`);
- el NIT todavía no se conoce, así que se usa uno provisional.

Es la "decisión comercial explícita" que `CONTEXT.md` exige para que una sede tenga wallet propia.

## Qué se movió y qué no

`npm run ops:split-store` hace lo siguiente en una sola transacción serializable:

1. Crea la empresa nueva ("Tatiana", +573003018490, Palacio Nacional Local 193). Copia del Lab la frecuencia de facturación y la comisión. Crea su wallet con la misma moneda.
2. Pasa la sede a la empresa nueva y la renombra a "Palacio Nacional 193" (dirección "Palacio Nacional Local 193"), porque el nombre anterior era incorrecto. Sus tarjetas QR van con ella, porque cuelgan de `storeId`.
3. Pasa a la empresa nueva las compras de la sede (`CodePurchase.companyId`).
4. Pasa a la wallet nueva los movimientos de esas compras y de las activaciones de la sede, junto con sus reversos.
5. Recalcula los dos ledgers (`rebuildWalletLedger`) y verifica que no queden con drift. Registra `AuditLog` `STORE_SPLIT_TO_COMPANY` con los ids movidos y los saldos.

No crea ajustes, notas crédito ni `OPENING_BALANCE`: el historial cambia de dueño, no se compensa.

El comando se niega a correr en estos casos:

- hay compras en vuelo;
- hay movimientos ya incluidos en un estado de cuenta;
- hay movimientos anteriores al saldo inicial vigente;
- la wallet de origen tiene drift;
- la sede tiene usuarios, números de origen, teléfonos autorizados o ítems de factura. Necesitarían su propia regla y el 192 no tiene ninguno.

No cambian:

- El `diemRequestSnapshot` de las compras sigue con `company_id` del Lab. Es el comando congelado que se envió a Diem y no se reenvía, porque las compras están COMPLETED.
- El webhook de fulfillment resuelve la compra por `diemRequestId`, así que un reverso futuro cae en la wallet nueva.
- En Diem, las 6 órdenes históricas siguen en la cuenta comercial `diem-sas:<Lab>` (ver "Lo que sigue").

## Estado en producción antes de aplicar (lectura del 7-nov-2026)

| | Lab hoy | Lab después | 192 después |
|---|---|---|---|
| Compras de la sede | 6 COMPLETED (10-oct → 3-nov) | 0 | 6 |
| Consumos movidos | — | — | 935.400 COP |
| Saldo wallet | −13.038.550 | **−12.103.150** | **−935.400** |

- La sede no tiene activaciones, números de origen, teléfonos autorizados, usuarios ni facturas.
- Tiene 24 tarjetas QR. Una está marcada como activada sin `CardActivation`: es legado.
- El Lab no tiene recargas confirmadas, estados de cuenta emitidos ni tarifas propias.

## Ensayo

Se ensayó en una copia de la base local, que es más vieja que prod y tiene 4 compras de la sede por 720.000.

- `plan` y `apply` dejaron Lab en −8.798.300 y 192 en −720.000.
- El segundo `apply` fue no-op.
- `wallet:verify` terminó sin hallazgos.
- Los tests están en `tests/store-split.test.mjs`, dentro de `npm run test:wallet-ledger`.

## Runbook en producción

Requiere el deploy de este commit. El comando corre desde diem-sas con `DATABASE_URL` de prod.

```bash
# 1. Plan (solo lectura). Revisar que diga 6 compras, 6 movimientos, 935400 y los saldos de la tabla.
npm run ops:split-store -- plan \
  --store cmj1ogatk0001dcr9ggd74svg \
  --name "Tatiana" \
  --tax-id PROVISIONAL-A534FR \
  --email info@tatiana.com --phone +573003018490 \
  --address "Palacio Nacional Local 193" \
  --store-name "Palacio Nacional 193" --store-address "Palacio Nacional Local 193" \
  --actor-user cmixxhiad00092fwzu5gsb6gy \
  --out .secure/split-palacio-193

# 2. Apply
npm run ops:split-store -- apply \
  --receipt .secure/split-palacio-193/receipt.json \
  --expected-database diemsas_zsft

# 3. Verificar
npm run wallet:verify
```

El `apply` imprime el `accountCode` (`diem-sas:<id nuevo>`). Con ese código, en el shell de Render de DevDiem se provisiona la cuenta comercial. Sin ella, la primera compra del 192 falla con "Commercial account not found".

```bash
python manage.py provision_commercial_account \
  --expected-database <base DevDiem prod> \
  --store-id <id tienda Diem 69063c2b…> \
  --account-code diem-sas:<id nuevo> \
  --operational-name "Tatiana" \
  --valid-from 2026-11-07 \
  --create-party --legal-name "Tatiana" --party-type natural_person \
  --service-account-slug diem-sas-production
# repetir con --apply después de revisar el dry-run
```

Después:

- Crear el usuario `GENERAL_ADMIN` del 192 desde Usuarios.
- Corregir el NIT desde Empresas cuando se conozca.
- Hacer una compra pequeña de prueba con el usuario del 192.

## Lo que sigue

- Reasignar en DevDiem las 6 órdenes históricas a la cuenta comercial nueva (`Order.commercial_account`, comprador y snapshot comercial), para que los reportes por cuenta en Diem cuadren con diem-sas. Antes hay que auditar qué más cuelga de la cuenta del Lab (pagos, cartera). El saldo vive en diem-sas (G5), así que no bloquea la separación.
- Cambiar la razón social provisional de la `LegalParty` cuando exista el NIT.

## Aplicado en producción (8-nov-2026)

- Empresa **Tatiana** `cmw8mltqs0001th9u61nssnhe`: info@tatiana.com, +573003018490, Palacio Nacional Local 193, NIT `PROVISIONAL-A534FR`. Su cuenta comercial es `diem-sas:cmw8mltqs0001th9u61nssnhe`.
- Saldos: Lab −12.103.150 y Tatiana −935.400.
- Sede renombrada a "Palacio Nacional 193", con sus 24 tarjetas.
- `wallet:verify` sin hallazgos; queda registrado en `AuditLog` `STORE_SPLIT_TO_COMPANY`.
- El primer intento falló sin dejar cambios: prod aún no tiene la migración `20261103113000_wallet_reversal_presentation`. Para el script basta con que `rebuildWalletLedger` devuelva solo `id`, que es lo único que necesita.
- Pendiente: `provision_commercial_account` en DevDiem con `--account-code diem-sas:cmw8mltqs0001th9u61nssnhe --party-type natural_person` y crear el usuario de Tatiana.
