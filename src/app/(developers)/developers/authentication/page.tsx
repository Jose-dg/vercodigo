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

      <h2>Formato y ambientes</h2>
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <InlineCode>vck_test_…</InlineCode> — <strong>sandbox</strong>: simula todo, no cobra (ver{" "}
          <Link className="underline" href="/developers/sandbox">Sandbox</Link>).
        </li>
        <li>
          <InlineCode>vck_live_…</InlineCode> — <strong>producción</strong>: cada entrega se cobra de tu billetera.
        </li>
      </ul>
      <p>Lo que sigue al ambiente (12 caracteres) es público y sirve para identificar la key en el portal. El resto es secreto.</p>

      <h2>Quién la crea y quién la guarda</h2>
      <ul className="list-disc space-y-2 pl-5">
        <li>
          La crea el dueño o un administrador general de tu empresa en{" "}
          <Link className="underline" href="/developers/api-keys">API keys</Link>.
        </li>
        <li>
          <strong>La mostramos una sola vez.</strong> Guardamos únicamente una huella cifrada y no es posible recuperar
          la key original. Si la pierdes, revócala y crea otra.
        </li>
        <li>
          La key actúa en nombre de quien la creó: compra con su sede de origen y deja de funcionar si esa persona se
          desactiva o deja de ser administradora.
        </li>
        <li>Puedes tener hasta 5 keys activas de cada ambiente, por ejemplo una por sistema.</li>
        <li>Las keys son de tu empresa: solo su dueño y sus administradores generales las ven y las gestionan.</li>
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
