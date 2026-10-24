import { CodeBlock } from "@/components/developers/code-block"
import { DocPage, Endpoint, apiBaseUrl } from "@/components/developers/doc-primitives"
import { DELIVERY_EXAMPLE, json, requestSamples } from "@/components/developers/samples"

export default function ListOrdersPage() {
  return (
    <DocPage title="Listar órdenes" lead="Órdenes de tu empresa, de la más reciente a la más antigua.">
      <Endpoint method="GET" path="/api/v1/orders" scope="deliveries:read" />
      <CodeBlock samples={requestSamples({ baseUrl: apiBaseUrl(), method: "GET", path: "/api/v1/orders?limit=20" })} />
      <CodeBlock samples={json({
        object: "list",
        livemode: true,
        data: [DELIVERY_EXAMPLE],
        pagination: { has_more: false, next_cursor: null },
      })} />
      <p>Una key sandbox solo lista órdenes simuladas; una key de producción solo lista órdenes reales.</p>
    </DocPage>
  )
}
