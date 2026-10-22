import { CodeBlock } from "@/components/developers/code-block"
import { DocPage, Endpoint, apiBaseUrl } from "@/components/developers/doc-primitives"
import { json, requestSamples } from "@/components/developers/samples"

export default function WalletPage() {
  return (
    <DocPage title="Saldo" lead="Saldo actual de la billetera de tu empresa.">
      <Endpoint method="GET" path="/api/v1/wallet" scope="wallet:read" />
      <CodeBlock samples={requestSamples({ baseUrl: apiBaseUrl(), method: "GET", path: "/api/v1/wallet" })} />
      <CodeBlock samples={json({ object: "wallet", balance: { amount: 1250000, currency: "COP" } })} />
      <p>Un saldo negativo es deuda de la empresa. Las recargas se hacen desde el portal, en Mi billetera.</p>
    </DocPage>
  )
}
