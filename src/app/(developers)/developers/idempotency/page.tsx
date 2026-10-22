import { Callout, DocPage, InlineCode } from "@/components/developers/doc-primitives"

export default function IdempotencyPage() {
  return (
    <DocPage
      title="Idempotencia"
      lead="Crear una entrega cobra dinero. El header Idempotency-Key garantiza que un reintento nunca cobre dos veces."
    >
      <p>
        Toda petición <InlineCode>POST /api/v1/deliveries</InlineCode> exige un <InlineCode>Idempotency-Key</InlineCode>{" "}
        único por entrega: 1 a 100 caracteres, con letras, números, <InlineCode>.</InlineCode>{" "}
        <InlineCode>_</InlineCode> <InlineCode>:</InlineCode> o <InlineCode>-</InlineCode>. Usa un identificador estable
        de tu sistema, por ejemplo <InlineCode>pedido-10293</InlineCode> o <InlineCode>nomina-2026-10-emp-55</InlineCode>.
      </p>
      <h2>Reglas</h2>
      <ul className="list-disc space-y-2 pl-5">
        <li>Si repites la misma petición con la misma key, recibes la misma entrega. No se cobra ni se envía otra vez.</li>
        <li>
          Si reusas una key con otro producto, otra cantidad u otro destinatario, la respuesta es <strong>409</strong>.
        </li>
        <li>Las keys valen para toda tu empresa, sin importar qué API key haga la petición.</li>
        <li>Sandbox y producción no comparten keys: probar con una no bloquea la otra.</li>
      </ul>
      <Callout>
        Si se corta la conexión o recibes un 5xx, reintenta con el mismo <InlineCode>Idempotency-Key</InlineCode>. Es
        seguro.
      </Callout>
    </DocPage>
  )
}
