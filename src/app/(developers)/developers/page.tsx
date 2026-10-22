import Link from "next/link"

import { CodeBlock } from "@/components/developers/code-block"
import { Callout, DocPage, InlineCode, apiBaseUrl } from "@/components/developers/doc-primitives"
import { requestSamples } from "@/components/developers/samples"

export default function DevelopersIntroPage() {
  const baseUrl = apiBaseUrl()
  return (
    <DocPage
      title="API para empresas"
      lead="Compra códigos digitales con cargo a tu billetera y haz que lleguen directo al email de tus clientes o empleados, desde tu propio sistema."
    >
      <h2>Cómo funciona</h2>
      <ol className="list-decimal space-y-2 pl-5">
        <li>
          Crea una API key en <Link className="underline" href="/developers/api-keys">API keys</Link>. Solo el
          dueño o un administrador general de la empresa puede crearla.
        </li>
        <li>
          Consulta el <Link className="underline" href="/developers/catalog">catálogo</Link> para conocer los productos y
          tu precio.
        </li>
        <li>
          <Link className="underline" href="/developers/deliveries/create">Crea una entrega</Link> con el producto y el
          destinatario. Se cobra de tu billetera y enviamos el código por email.
        </li>
        <li>
          <Link className="underline" href="/developers/deliveries/retrieve">Consulta la entrega</Link> para saber si el
          email ya salió.
        </li>
      </ol>

      <h2>URL base</h2>
      <p>
        Todas las rutas parten de <InlineCode>{`${baseUrl}/api/v1`}</InlineCode>. Las peticiones y respuestas son JSON,
        con campos en <InlineCode>snake_case</InlineCode>.
      </p>

      <h2>Primera petición</h2>
      <CodeBlock samples={requestSamples({ baseUrl, method: "GET", path: "/api/v1/wallet" })} />

      <Callout>
        La API nunca devuelve los códigos: los enviamos por email al destinatario. Así, una API key filtrada no permite
        sacar códigos. Tú siempre puedes verlos en el portal, en <em>Mis solicitudes</em>.
      </Callout>
    </DocPage>
  )
}
