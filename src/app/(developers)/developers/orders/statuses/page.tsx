import { DocPage, InlineCode, ParamTable } from "@/components/developers/doc-primitives"

export default function OrderStatusesPage() {
  return (
    <DocPage title="Estados de orden" lead="Usa el estado para decidir si esperas, completas el flujo o intervienes.">
      <ParamTable params={[
        { name: "processing", type: "temporal", description: "La orden está siendo procesada. Consulta nuevamente." },
        { name: "awaiting_stock", type: "temporal", description: "Espera inventario. Todavía no se cobra." },
        { name: "completed", type: "final", description: "La compra fue cobrada y la entrega terminó." },
        { name: "action_required", type: "atención", description: "Requiere revisión; no se cobra mientras siga así." },
        { name: "failed", type: "final", description: "La orden falló y no fue cobrada." },
      ]} />
      <p>
        El campo <InlineCode>email_delivery</InlineCode> puede ser <InlineCode>sending</InlineCode>,{" "}
        <InlineCode>sent</InlineCode>, <InlineCode>failed</InlineCode> o <InlineCode>null</InlineCode>.
      </p>
    </DocPage>
  )
}
