import { CodeBlock } from "@/components/developers/code-block"
import { DocPage, Endpoint, apiBaseUrl } from "@/components/developers/doc-primitives"
import { DELIVERY_EXAMPLE, json, requestSamples } from "@/components/developers/samples"

export default function RetrieveDeliveryPage() {
  return (
    <DocPage
      title="Obtener una orden"
      lead="Consulta el estado de una orden y de su email, sin exponer el código enviado al destinatario."
    >
      <Endpoint method="GET" path="/api/v1/orders/{id}" scope="deliveries:read" />
      <CodeBlock samples={requestSamples({ baseUrl: apiBaseUrl(), method: "GET", path: "/api/v1/orders/cmv1k2delivery" })} />
      <CodeBlock samples={json(DELIVERY_EXAMPLE)} />
      <p>
        Consulta cada pocos minutos mientras <code>status</code> sea <code>processing</code> o{" "}
        <code>awaiting_stock</code>.
      </p>
      <p>La respuesta nunca contiene el código o PIN. Diem lo envía exclusivamente al email del destinatario.</p>
    </DocPage>
  )
}
