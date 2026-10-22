import { CodeBlock } from "@/components/developers/code-block"
import { DocPage, InlineCode, ParamTable } from "@/components/developers/doc-primitives"
import { json } from "@/components/developers/samples"
import { API_RATE_LIMIT_PER_MINUTE } from "@/modules/api-keys/domain"

export default function ErrorsPage() {
  return (
    <DocPage title="Errores y límites" lead="Los errores responden con un código HTTP y un JSON con error y message.">
      <CodeBlock samples={json({ error: "CONFLICT", message: "Idempotency-Key ya fue usada con otra compra" })} />
      <ParamTable
        params={[
          { name: "400", type: "BAD_REQUEST", description: "Cuerpo o headers inválidos. El mensaje dice qué campo falla." },
          { name: "401", type: "UNAUTHORIZED", description: "Falta la API key, es inválida, está revocada o venció." },
          { name: "403", type: "FORBIDDEN", description: "La key no tiene el permiso que exige la ruta." },
          { name: "404", type: "NOT_FOUND", description: "El recurso no existe o es de otra empresa." },
          {
            name: "409",
            type: "CONFLICT",
            description: "Idempotency-Key reusada con otros datos, o el precio cambió respecto a expected_unit_price.",
          },
          { name: "429", type: "RATE_LIMIT", description: <>Demasiadas peticiones. Respeta el header <InlineCode>Retry-After</InlineCode>.</> },
          { name: "5xx", type: "INTERNAL", description: "Error nuestro. Reintenta con el mismo Idempotency-Key." },
        ]}
      />
      <h2>Límites</h2>
      <p>
        {API_RATE_LIMIT_PER_MINUTE} peticiones por minuto por API key, y hasta 100 códigos por entrega. Si necesitas más,
        escríbenos.
      </p>
    </DocPage>
  )
}
