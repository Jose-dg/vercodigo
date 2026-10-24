import { CodeBlock } from "@/components/developers/code-block"
import { DocPage, Endpoint, apiBaseUrl } from "@/components/developers/doc-primitives"
import { json, requestSamples } from "@/components/developers/samples"

export default function RetrieveTransactionPage() {
  return (
    <DocPage title="Obtener una transacción" lead="Consulta un movimiento específico de la billetera de tu empresa.">
      <Endpoint method="GET" path="/api/v1/transactions/{id}" scope="wallet:read" />
      <CodeBlock samples={requestSamples({ baseUrl: apiBaseUrl(), method: "GET", path: "/api/v1/transactions/cm_tx_123" })} />
      <CodeBlock samples={json({
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
      })} />
    </DocPage>
  )
}
