import { CodeBlock } from "@/components/developers/code-block"
import { Callout, DocPage, Endpoint, InlineCode, ParamTable, apiBaseUrl } from "@/components/developers/doc-primitives"
import { DELIVERY_EXAMPLE, json, requestSamples } from "@/components/developers/samples"

export default function CreateDeliveryPage() {
  return (
    <DocPage
      title="Crear una orden"
      lead="Compra uno o más códigos con cargo a tu billetera y envíalos por email a una persona."
    >
      <Endpoint method="POST" path="/api/v1/deliveries" scope="deliveries:create" />
      <CodeBlock
        samples={requestSamples({
          baseUrl: apiBaseUrl(),
          method: "POST",
          path: "/api/v1/deliveries",
          idempotencyKey: "pedido-10293",
          body: {
            product_id: "cmprod_netflix",
            denomination_id: "cmden_netflix_20",
            quantity: 1,
            recipient: { first_name: "Luis", last_name: "Gómez", email: "luis@cliente.co" },
          },
        })}
      />

      <h2>Cuerpo</h2>
      <ParamTable
        params={[
          { name: "product_id", type: "string", required: true, description: "Del catálogo." },
          { name: "denomination_id", type: "string", description: "Obligatorio si el producto tiene varios valores." },
          {
            name: "quantity",
            type: "entero 1–100",
            required: true,
            description: "Códigos a comprar. Todos van en el mismo email.",
          },
          { name: "recipient.first_name", type: "string", required: true, description: "Nombre de quien recibe." },
          { name: "recipient.last_name", type: "string", description: "Apellido." },
          {
            name: "recipient.email",
            type: "string",
            required: true,
            description: "Email al que enviamos los códigos. Verifícalo: un código enviado no se puede recuperar.",
          },
          {
            name: "expected_unit_price",
            type: "{ amount, currency }",
            description: "Si el precio actual es otro, respondemos 409 y no cobramos.",
          },
        ]}
      />
      <p>
        Header obligatorio: <InlineCode>Idempotency-Key</InlineCode> (ver Idempotencia).
      </p>

      <h2>Respuesta 201</h2>
      <CodeBlock samples={json(DELIVERY_EXAMPLE)} />
      <ParamTable
        params={[
          {
            name: "status",
            type: "string",
            description: (
              <>
                <InlineCode>processing</InlineCode> · <InlineCode>awaiting_stock</InlineCode> (se entrega al reponer
                inventario) · <InlineCode>completed</InlineCode> (cobrado) · <InlineCode>action_required</InlineCode>{" "}
                (en revisión, sin cobro) · <InlineCode>failed</InlineCode> (sin cobro)
              </>
            ),
          },
          {
            name: "email_delivery",
            type: "string | null",
            description: (
              <>
                <InlineCode>sending</InlineCode> · <InlineCode>sent</InlineCode> (el proveedor aceptó el email) ·{" "}
                <InlineCode>failed</InlineCode>
              </>
            ),
          },
        ]}
      />
      <Callout>
        La billetera se debita solo cuando la orden queda <InlineCode>completed</InlineCode>. Si no hay inventario, la
        orden espera sin cobro.
      </Callout>
    </DocPage>
  )
}
