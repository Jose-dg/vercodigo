import Link from "next/link"

import { CodeBlock } from "@/components/developers/code-block"
import { Callout, DocPage, InlineCode, ParamTable, apiBaseUrl } from "@/components/developers/doc-primitives"
import { requestSamples } from "@/components/developers/samples"
import { API_KEY_SCOPES, API_KEY_SCOPE_LABELS } from "@/modules/api-keys/domain"

export default function AuthenticationPage() {
  return (
    <DocPage
      title="Autenticación"
      lead="Cada petición lleva una API key de tu empresa en el header Authorization."
    >
      <CodeBlock samples={requestSamples({ baseUrl: apiBaseUrl(), method: "GET", path: "/api/v1/catalog" })} />

      <h2>Formato</h2>
      <p>
        Una key se ve así: <InlineCode>vck_live_3f9a1c2b7d4e_…</InlineCode>. La primera parte es pública y te sirve
        para identificarla en el portal. El resto es secreto.
      </p>

      <h2>Quién la crea y quién la guarda</h2>
      <ul className="list-disc space-y-2 pl-5">
        <li>
          La crea el dueño o un administrador general de tu empresa en{" "}
          <Link className="underline" href="/developers/api-keys">API keys</Link>.
        </li>
        <li>
          <strong>La mostramos una sola vez.</strong> Nosotros guardamos solo una huella cifrada: nadie en Diem puede
          verla ni recuperarla. Si la pierdes, revócala y crea otra.
        </li>
        <li>
          La key actúa en nombre de quien la creó: compra con su sede de origen y deja de funcionar si esa persona se
          desactiva o deja de ser administradora.
        </li>
        <li>Puedes tener hasta 5 keys activas, por ejemplo una por sistema o por ambiente.</li>
      </ul>

      <h2>Permisos</h2>
      <ParamTable
        params={API_KEY_SCOPES.map((scope) => ({ name: scope, type: "permiso", description: API_KEY_SCOPE_LABELS[scope] }))}
      />

      <Callout tone="warning">
        Guarda la key en una variable de entorno o en un gestor de secretos de tu servidor. Nunca la pongas en una app
        móvil, en el navegador ni en un repositorio.
      </Callout>
    </DocPage>
  )
}
