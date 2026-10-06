# Vercode Commercial Accounts

Este contexto describe la relación financiera informativa entre Vercode y cada empresa B2B. El ledger conserva la verdad operativa; los documentos emitidos preservan una fotografía comprensible de esa verdad.

## Language

**Estado de cuenta**:
Documento informativo e inmutable que resume movimientos confirmados y el saldo de una empresa hasta una fecha de corte. No acredita un pago ni tiene validez de factura fiscal.
_Avoid_: Factura, recibo, cuenta de cobro

**Ledger de wallet**:
Histórico cronológico que constituye la fuente de verdad del saldo de una empresa. Un saldo negativo representa una obligación pendiente y uno positivo, saldo a favor.
_Avoid_: Estado de cuenta, factura

**Factura fiscal**:
Documento tributario emitido y validado mediante el proceso fiscal aplicable. Es independiente del estado de cuenta y del ledger de wallet.
_Avoid_: Estado de cuenta, reporte de movimientos

**Corte**:
Límite temporal hasta el cual se incluyen movimientos confirmados en un estado de cuenta. Un movimiento pertenece como máximo a un corte.
_Avoid_: Ajuste, cierre contable

**Saldo inicial**:
Hecho autoritativo que inicia un tramo vigente del ledger con un saldo conocido. No compensa movimientos anteriores y no es ajuste, pago ni nota crédito.
_Avoid_: Ajuste, refund, nota crédito

**Número de origen**:
Número asociado a la procedencia comercial de una compra dentro de una empresa. Puede existir sin sede y no autoriza por sí mismo activaciones de tarjetas.
_Avoid_: Número autorizado, sede, wallet

**Sede de origen**:
Local al que se atribuye una compra para operación y reportes. No posee una wallet independiente salvo decisión comercial explícita.
_Avoid_: Empresa, número de origen
