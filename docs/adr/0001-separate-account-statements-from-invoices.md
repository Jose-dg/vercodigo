# Separar estados de cuenta de facturas

Los estados de cuenta se modelan como snapshots inmutables del ledger de wallet y no como `Invoice`: la factura existente representa comisiones y activaciones QR, mientras el estado de cuenta es informativo y no fiscal. Esta separación evita que un reporte de saldo adquiera semántica tributaria por accidente y permite integrar posteriormente un proveedor fiscal sin reinterpretar documentos ya emitidos.
