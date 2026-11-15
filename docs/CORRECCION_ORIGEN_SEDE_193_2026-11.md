# Corrección de origen para la sede 193 (noviembre de 2026)

## Regla comercial

- **Compañía y wallet:** Laboratorio Clínica del Play.
- **Origen comercial correcto:** la sede Laboratorio Clínica del Play 193.
- La sede 193 no es una compañía independiente y no recibe una wallet propia.

La corrección cambia únicamente la atribución comercial de compras ya completadas.
No cambia compañías, importes, códigos, estados, fechas, consumos ni saldos.

## Sin migraciones ni SQL de reparación

Este procedimiento no modifica `schema.prisma`, no crea migraciones y no ejecuta
actualizaciones SQL. El comando operativo llama a
`applyPurchaseOriginCorrection`, el mismo caso de uso protegido que utiliza el
portal. Ese servicio:

1. valida que la sede pertenezca a la compañía de la compra;
2. corrige primero el origen en DevDiem con idempotencia;
3. actualiza `CodePurchase` dentro de una transacción serializable;
4. crea el `AuditLog` `PURCHASE_ORIGIN_CORRECTED`.

## 1. Plan de solo lectura

Ejecutar desde `diem-sas` con `DATABASE_URL` apuntando a la base que se desea
auditar:

```bash
TS_NODE_BASEURL=. TS_NODE_TRANSPILE_ONLY=1 \
  TS_NODE_COMPILER_OPTIONS='{"module":"CommonJS","moduleResolution":"node"}' \
  node --conditions=react-server -r ts-node/register -r tsconfig-paths/register \
  scripts/ops/correct-store-purchase-origins.ts plan \
  --company <id-compañía-laboratorio> \
  --source-store <id-sede-incorrecta> \
  --target-store <id-sede-193> \
  --actor-user <id-admin-plataforma> \
  --out .secure/origin-repair-193/receipt.json
```

El plan incluye todas las compras de la sede incorrecta, pero solo deja como
elegibles las que:

- fueron creadas por un `SUPER_ADMIN` o `SYSTEM_ADMIN`;
- están `COMPLETED`;
- tienen `diemRequestId`.

Las demás aparecen en `excluded` con la razón y no se modifican. El recibo
contiene compañía, sedes, wallet de control, origen esperado, movimientos
financieros y un fingerprint. Revisar cada ID antes de aplicar.

## 2. Aplicación controlada

```bash
TS_NODE_BASEURL=. TS_NODE_TRANSPILE_ONLY=1 \
  TS_NODE_COMPILER_OPTIONS='{"module":"CommonJS","moduleResolution":"node"}' \
  node --conditions=react-server -r ts-node/register -r tsconfig-paths/register \
  scripts/ops/correct-store-purchase-origins.ts apply \
  --receipt .secure/origin-repair-193/receipt.json \
  --expected-database <nombre-exacto-base> \
  --report .secure/origin-repair-193/report.json
```

Opcionalmente se puede pasar `--reason`, con un texto de 3 a 500 caracteres.
El valor predeterminado es:

> Compra administrativa atribuida por error a la sede principal; corresponde a la sede 193

Antes de escribir, `apply` vuelve a verificar:

- identidad de la base;
- que no sea réplica ni esté en modo de solo lectura;
- fingerprint del recibo;
- compañía, wallet, sedes y actor;
- estado, referencia remota y origen esperado de cada compra;
- que los movimientos financieros no hayan cambiado desde el plan.

Cada compra usa una clave de idempotencia derivada del recibo. Si la ejecución
se interrumpe, se corrige la causa y se repite con el mismo recibo. El reporte
indica qué compras ya alcanzaron el servicio.

## 3. Verificación

El reporte compara los movimientos relacionados antes y después. Deben permanecer
idénticos. También muestra el saldo de la wallet antes y después; una diferencia
puede deberse a actividad concurrente de la compañía, pero nunca a este caso de
uso, que no escribe en el ledger.

Después de una compra piloto, comprobar:

- `CodePurchase.companyId` sigue apuntando al Laboratorio;
- `CodePurchase.storeId` apunta a la sede 193;
- `purchaseOriginPhoneId` es `null`;
- DevDiem muestra el mismo origen;
- existe `PURCHASE_ORIGIN_CORRECTED`;
- no cambiaron los movimientos vinculados a la compra.

Una compra en curso, cancelada, fallida, revertida, sin referencia remota o con
documento comercial emitido se investiga por separado. Nunca se fuerza una
actualización local si DevDiem rechazó el cambio.
