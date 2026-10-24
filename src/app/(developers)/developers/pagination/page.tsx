import { CodeBlock } from "@/components/developers/code-block"
import { DocPage, InlineCode, ParamTable } from "@/components/developers/doc-primitives"
import { json } from "@/components/developers/samples"

export default function PaginationPage() {
  return (
    <DocPage title="Paginación" lead="Los listados usan cursores estables para no saltar ni repetir registros.">
      <ParamTable params={[
        { name: "limit", type: "entero", description: "Registros por llamada. Predeterminado 20; máximo 100." },
        { name: "starting_after", type: "string", description: "Cursor next_cursor recibido en la página anterior." },
      ]} />
      <CodeBlock samples={json({
        object: "list",
        data: [{ id: "cm_order_123" }],
        pagination: { has_more: true, next_cursor: "cm_order_123" },
      })} />
      <p>
        Para continuar, envía <InlineCode>?limit=20&amp;starting_after=cm_order_123</InlineCode>. Cuando{" "}
        <InlineCode>has_more</InlineCode> sea falso, terminaste el recorrido.
      </p>
    </DocPage>
  )
}
