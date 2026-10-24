import { CodeBlock } from "@/components/developers/code-block"
import { DocPage, InlineCode, apiBaseUrl } from "@/components/developers/doc-primitives"
import { json } from "@/components/developers/samples"

export default function BaseUrlPage() {
  const baseUrl = apiBaseUrl()
  return (
    <DocPage title="Base URL" lead="Todas las rutas públicas parten del mismo dominio y de la versión v1.">
      <CodeBlock samples={json({ base_url: `${baseUrl}/api/v1` })} />
      <p>
        Construye cada petición agregando la ruta del recurso, por ejemplo <InlineCode>/catalog</InlineCode> o{" "}
        <InlineCode>/orders</InlineCode>. Las respuestas usan JSON y nombres de campos en <InlineCode>snake_case</InlineCode>.
      </p>
      <p>No fijes el dominio en varios lugares: guárdalo como configuración por ambiente junto con tu API key.</p>
    </DocPage>
  )
}
