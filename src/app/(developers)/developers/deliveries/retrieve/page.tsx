import { CodeBlock } from "@/components/developers/code-block"
import { DocPage, Endpoint, apiBaseUrl } from "@/components/developers/doc-primitives"
import { DELIVERY_EXAMPLE, json, requestSamples } from "@/components/developers/samples"

export default function RetrieveDeliveryPage() {
  return (
    <DocPage
      title="Consultar entrega"
      lead="Estado de una entrega y de su email. Sirve para entregas creadas por API y para compras hechas en el portal."
    >
      <Endpoint method="GET" path="/api/v1/deliveries/{id}" scope="deliveries:read" />
      <CodeBlock samples={requestSamples({ baseUrl: apiBaseUrl(), method: "GET", path: "/api/v1/deliveries/cmv1k2delivery" })} />
      <CodeBlock samples={json(DELIVERY_EXAMPLE)} />
      <p>
        Consulta cada pocos minutos mientras <code>status</code> sea <code>processing</code> o{" "}
        <code>awaiting_stock</code>.
      </p>
    </DocPage>
  )
}
