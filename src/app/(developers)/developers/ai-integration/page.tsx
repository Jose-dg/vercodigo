import Link from 'next/link';

import { aiIntegrationPromptSamples } from '@/components/developers/ai-integration-prompt';
import { CodeBlock } from '@/components/developers/code-block';
import { Callout, DocPage, InlineCode, apiBaseUrl } from '@/components/developers/doc-primitives';

export default function AiIntegrationPage() {
    const samples = aiIntegrationPromptSamples(apiBaseUrl());

    return (
        <DocPage
            title="Integrar con IA"
            lead="Copia un prompt completo para que tu agente de código implemente la API de Vercode siguiendo el contrato y las prácticas de seguridad correctas."
        >
            <Callout tone="warning">
                No pegues una API key en el prompt. El agente debe referenciar <InlineCode>DIEM_API_KEY</InlineCode> y tú
                debes configurarla en las variables de entorno del servidor.
            </Callout>

            <h2>Elige el stack</h2>
            <p>
                Selecciona la tecnología de tu proyecto y copia el prompt. Las tres variantes incluyen el contrato
                completo porque esta documentación requiere una sesión y el agente podría no tener acceso a ella.
            </p>
            <CodeBlock samples={samples} copyLabel="Copiar prompt" />

            <h2>Antes de ejecutar el agente</h2>
            <ol className="list-decimal space-y-2 pl-5">
                <li>
                    Crea una key de <Link className="underline" href="/developers/sandbox">sandbox</Link> con los permisos
                    que utilizará la integración.
                </li>
                <li>
                    Guarda la key siguiendo la guía de <Link className="underline" href="/developers/api-keys">API keys</Link>.
                </li>
                <li>
                    Revisa las reglas de <Link className="underline" href="/developers/idempotency">idempotencia</Link>{' '}
                    antes de permitir que el agente implemente órdenes.
                </li>
                <li>
                    Valida cómo responderá tu producto a cada <Link className="underline" href="/developers/orders/statuses">estado de orden</Link>.
                </li>
            </ol>

            <Callout>
                Revisa el diff y las pruebas que produzca el agente antes de desplegar. Una integración correcta comienza
                en sandbox y nunca ejecuta compras de producción desde tests.
            </Callout>
        </DocPage>
    );
}
