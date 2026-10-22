import Link from "next/link"

import { CodeBlock } from "@/components/developers/code-block"
import { Callout, DocPage, InlineCode, ParamTable, apiBaseUrl } from "@/components/developers/doc-primitives"
import { json, requestSamples } from "@/components/developers/samples"
import { SANDBOX_SCENARIOS } from "@/modules/api-v1/sandbox-scenarios"

export default function SandboxPage() {
  return (
    <DocPage
      title="Sandbox (pruebas)"
      lead="Integra y prueba sin gastar dinero. Con una key vck_test_ las mismas rutas responden igual, pero nada es real."
    >
      <h2>Qué cambia con una key sandbox</h2>
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <strong>No cobra:</strong> la billetera no se toca. <InlineCode>GET /api/v1/wallet</InlineCode> devuelve un
          saldo ficticio.
        </li>
        <li>
          <strong>No compra códigos ni envía emails:</strong> la entrega se simula y queda guardada para consultarla.
        </li>
        <li>
          <strong>Mismas validaciones:</strong> producto, denominación, precio real de tu empresa,{" "}
          <InlineCode>expected_unit_price</InlineCode>, idempotencia, permisos y límites.
        </li>
        <li>
          Las respuestas traen <InlineCode>{'"livemode": false'}</InlineCode>. Las entregas sandbox no aparecen en el portal
          ni en tus estados de cuenta, y una key de producción no las puede leer (ni al revés).
        </li>
      </ul>

      <h2>Simular resultados</h2>
      <p>Elige el resultado con una etiqueta al final de la parte local del email del destinatario:</p>
      <ParamTable
        params={SANDBOX_SCENARIOS.map((entry) => ({
          name: entry.tag ? `luis${entry.tag}@ejemplo.com` : "luis@ejemplo.com",
          type: entry.scenario.status,
          description: entry.description,
        }))}
      />

      <CodeBlock
        samples={requestSamples({
          baseUrl: apiBaseUrl(),
          method: "POST",
          path: "/api/v1/deliveries",
          idempotencyKey: "prueba-001",
          body: {
            product_id: "cmprod_netflix",
            denomination_id: "cmden_netflix_20",
            quantity: 1,
            recipient: { first_name: "Luis", last_name: "Gómez", email: "luis+fail@ejemplo.com" },
          },
        })}
      />
      <CodeBlock
        samples={json({
          id: "cmv1sandbox01",
          object: "delivery",
          livemode: false,
          status: "completed",
          email_delivery: "failed",
          total: { amount: 85000, currency: "COP" },
        })}
      />

      <Callout tone="warning">
        Al pasar a producción cambia la key por una <InlineCode>vck_live_</InlineCode> desde{" "}
        <Link className="underline" href="/developers/api-keys">API keys</Link>. Desde ese momento cada entrega
        consume saldo real de tu billetera.
      </Callout>
    </DocPage>
  )
}
