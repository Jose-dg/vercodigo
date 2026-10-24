import { CodeBlock } from "@/components/developers/code-block"
import { DocPage, Endpoint, apiBaseUrl } from "@/components/developers/doc-primitives"
import { json, requestSamples } from "@/components/developers/samples"

const transaction = {
  id: "cm_tx_123",
  object: "transaction",
  type: "consumption",
  status: "confirmed",
  amount: { amount: 85000, currency: "COP" },
  balance_after: { amount: 1165000, currency: "COP" },
  description: "Compra de 1 código Netflix Gift Card",
  external_reference: null,
  occurred_at: "2026-10-22T15:04:07.000Z",
  created_at: "2026-10-22T15:04:07.000Z",
}

export default function ListTransactionsPage() {
  return (
    <DocPage title="Listar transacciones" lead="Movimientos confirmados o pendientes de la billetera de tu empresa.">
      <Endpoint method="GET" path="/api/v1/transactions" scope="wallet:read" />
      <CodeBlock samples={requestSamples({ baseUrl: apiBaseUrl(), method: "GET", path: "/api/v1/transactions?limit=20" })} />
      <CodeBlock samples={json({
        object: "list",
        livemode: true,
        data: [transaction],
        pagination: { has_more: false, next_cursor: null },
      })} />
      <p>Las keys sandbox no exponen movimientos reales de la billetera.</p>
    </DocPage>
  )
}
