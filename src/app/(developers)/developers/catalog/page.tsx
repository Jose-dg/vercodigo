import { CodeBlock } from "@/components/developers/code-block"
import { DocPage, Endpoint, InlineCode, ParamTable, apiBaseUrl } from "@/components/developers/doc-primitives"
import { json, requestSamples } from "@/components/developers/samples"

export default function CatalogPage() {
  return (
    <DocPage title="Catálogo" lead="Productos que tu empresa puede comprar, con tu precio.">
      <Endpoint method="GET" path="/api/v1/catalog" scope="catalog:read" />
      <CodeBlock samples={requestSamples({ baseUrl: apiBaseUrl(), method: "GET", path: "/api/v1/catalog" })} />
      <CodeBlock
        samples={json({
          object: "list",
          data: [
            {
              product_id: "cmprod_netflix",
              denomination_id: "cmden_netflix_20",
              name: "Netflix Gift Card",
              brand: "Netflix",
              category: "Streaming",
              face_value: { amount: 20, currency: "USD" },
              region: "US",
              unit_price: { amount: 85000, currency: "COP" },
            },
          ],
        })}
      />
      <ParamTable
        params={[
          { name: "product_id", type: "string", description: "Identificador del producto, para crear la entrega." },
          {
            name: "denomination_id",
            type: "string | null",
            description: "Valor del producto. Envíalo al crear la entrega si el producto tiene varios.",
          },
          { name: "face_value", type: "objeto | null", description: "Valor nominal del código." },
          {
            name: "unit_price",
            type: "objeto",
            description: (
              <>
                Lo que se cobra hoy de tu billetera por cada código. Puede cambiar con la tasa del día: para fijarlo,
                usa <InlineCode>expected_unit_price</InlineCode> al crear la entrega.
              </>
            ),
          },
        ]}
      />
    </DocPage>
  )
}
