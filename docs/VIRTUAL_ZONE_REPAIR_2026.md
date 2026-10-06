# Virtual Zone: reconstrucción comercial de septiembre–octubre de 2026

Este procedimiento corrige las 12 compras y el saldo compartido de Virtual Zone. No crea notas crédito, ajustes ni compras nuevas. El manifiesto privado está excluido de Git, su directorio y archivo usan permisos `0700/0600`, y los comandos no imprimen PINes.

Manifiesto esperado:

```text
.secure/virtual-zone-2026-10.json
SHA-256: 418d2b846b45d7f4d3a8bbbde065262aa21852b01bf34cda0cb5aee47d4c2685
```

## 1. Desplegar cambios aditivos

En `diem`, aplicar las migraciones hasta `sales.0036_order_commercial_metadata`. En `diem-sas`, aplicar `20261006120000_wallet_origin_and_effective_time`. No ejecutar los `apply` históricos hasta que ambas aplicaciones estén usando el nuevo esquema.

## 2. Generar ambos planes

Desde `diem`:

```bash
python manage.py repair_virtual_zone_history plan \
  --manifest ../diem-sas/.secure/virtual-zone-2026-10.json \
  --manifest-sha256 418d2b846b45d7f4d3a8bbbde065262aa21852b01bf34cda0cb5aee47d4c2685 \
  --receipt ../diem-sas/.secure/virtual-zone-diem-plan.json
```

Desde `diem-sas`:

```bash
npm run repair:virtual-zone -- plan \
  --input .secure/virtual-zone-2026-10.json \
  --manifest-sha256 418d2b846b45d7f4d3a8bbbde065262aa21852b01bf34cda0cb5aee47d4c2685 \
  --receipt .secure/virtual-zone-sas-plan.json
```

## 3. Aplicar primero `diem`

```bash
python manage.py repair_virtual_zone_history apply \
  --manifest ../diem-sas/.secure/virtual-zone-2026-10.json \
  --manifest-sha256 418d2b846b45d7f4d3a8bbbde065262aa21852b01bf34cda0cb5aee47d4c2685 \
  --receipt ../diem-sas/.secure/virtual-zone-diem-plan.json \
  --backup ../diem-sas/.secure/virtual-zone-diem-backup.json \
  --report ../diem-sas/.secure/virtual-zone-diem-report.json \
  --expected-database '<NOMBRE_EXACTO_BASE_DIEM>'
```

El reporte debe indicar 12 órdenes, 15 códigos entregados, 12 coincidencias comerciales y total `1361250.00`. Repetir `plan` debe mostrar esos mismos valores sin modificar datos.

## 4. Aplicar `diem-sas`

```bash
npm run repair:virtual-zone -- apply \
  --input .secure/virtual-zone-2026-10.json \
  --manifest-sha256 418d2b846b45d7f4d3a8bbbde065262aa21852b01bf34cda0cb5aee47d4c2685 \
  --receipt .secure/virtual-zone-sas-plan.json \
  --backup .secure/virtual-zone-sas-backup.json \
  --report .secure/virtual-zone-sas-report.json \
  --expected-database '<NOMBRE_EXACTO_BASE_DIEM_SAS>'
```

El reporte debe terminar con balance `-1640450`, 12 compras y un único `OPENING_BALANCE`. Un nuevo `plan` debe ser válido y una repetición `apply` con su recibo nuevo debe ser un no-op comercial.

Conservar ambos respaldos privados hasta terminar la comparación cruzada. Los respaldos contienen todos los campos modificados; el de `diem-sas` contiene los PINes y nunca debe copiarse a logs, tickets o repositorios.
