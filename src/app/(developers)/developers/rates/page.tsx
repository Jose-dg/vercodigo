import { CodeBlock } from "@/components/developers/code-block"
import { DocPage, Endpoint, InlineCode, apiBaseUrl } from "@/components/developers/doc-primitives"
import { json, requestSamples } from "@/components/developers/samples"

export default function RatesPage() {
  return (
    <DocPage title="Rates" lead="Tarifas comerciales vigentes para tu empresa por producto y denominación.">
      <Endpoint method="GET" path="/api/v1/rates" scope="catalog:read" />
      <CodeBlock samples={requestSamples({ baseUrl: apiBaseUrl(), method: "GET", path: "/api/v1/rates" })} />
      <CodeBlock samples={json({ object: "list", data: [{
        product_id: "cmprod_netflix",
        denomination_id: "cmden_netflix_20",
        name: "Netflix Gift Card",
        brand: "Netflix",
        unit_price: { amount: 85000, currency: "COP" },
      }] })} />
      <p>
        La tarifa puede cambiar. Al crear una orden, envía <InlineCode>expected_unit_price</InlineCode> para evitar un
        cobro distinto al que aprobó tu sistema.
      </p>
    </DocPage>
  )
}
