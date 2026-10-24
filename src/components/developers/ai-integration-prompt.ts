import type { CodeSample } from './code-block';

export type AiIntegrationStack = 'typescript' | 'python' | 'other';

const STACK_GUIDANCE: Record<AiIntegrationStack, string> = {
    typescript: [
        'Stack objetivo: Node.js con TypeScript.',
        '- Crea tipos explícitos para requests, responses, listas paginadas, errores y estados.',
        '- Usa fetch del runtime o el cliente HTTP que ya tenga el proyecto; no agregues una dependencia sin necesidad.',
    ].join('\n'),
    python: [
        'Stack objetivo: Python.',
        '- Usa type hints y modelos compatibles con las convenciones existentes del proyecto.',
        '- Reutiliza requests, httpx o el cliente HTTP que ya tenga el proyecto; no agregues una dependencia sin necesidad.',
    ].join('\n'),
    other: [
        'Stack objetivo: detecta el lenguaje y framework de este repositorio.',
        '- Sigue sus convenciones para configuración, tipado, cliente HTTP, errores y pruebas.',
        '- No introduzcas un framework o una dependencia nueva si las herramientas existentes son suficientes.',
    ].join('\n'),
};

/** Self-contained because coding agents cannot read the authenticated docs. */
export function aiIntegrationPrompt(baseUrl: string, stack: AiIntegrationStack): string {
    const apiBaseUrl = `${baseUrl.replace(/\/+$/, '')}/api/v1`;

    return `Quiero que integres la API v1 de Vercode en este proyecto.

Antes de modificar código:
1. Inspecciona la arquitectura, configuración, cliente HTTP, manejo de errores y pruebas existentes.
2. Explica brevemente qué módulos vas a tocar y conserva los patrones del repositorio.

${STACK_GUIDANCE[stack]}

Contrato de la API:
- Base URL: ${apiBaseUrl}
- Autenticación: Authorization: Bearer \${DIEM_API_KEY}
- Guarda DIEM_API_KEY únicamente en variables de entorno o en el gestor de secretos del servidor.
- Nunca envíes la API key al navegador o a una app móvil; tampoco la imprimas, registres ni incluyas en el repositorio.
- Comienza con una key sandbox. No ejecutes compras reales ni uses una key de producción durante el desarrollo o las pruebas.
- Todas las peticiones y respuestas usan JSON con campos snake_case.

Implementa un cliente server-side con timeout configurable y funciones para:
- GET /catalog
- GET /rates
- GET /wallet
- POST /deliveries
- GET /orders y GET /orders/{id}
- GET /transactions y GET /transactions/{id}

Reglas obligatorias:
- POST /deliveries requiere un header Idempotency-Key de 1 a 100 caracteres.
- Genera una clave nueva por operación lógica y reutiliza exactamente la misma al reintentar esa operación por error de red o 5xx.
- No reintentes automáticamente errores 4xx ni generes otra Idempotency-Key para ocultar un conflicto.
- Para crear una entrega envía product_id, quantity, recipient.first_name y recipient.email. Envía denomination_id cuando corresponda y expected_unit_price cuando el flujo ya tenga una cotización.
- Los listados usan limit (20 por defecto, 100 máximo) y starting_after. Continúa con pagination.next_cursor mientras pagination.has_more sea true.
- Maneja los estados processing, awaiting_stock, completed, action_required y failed.
- email_delivery puede ser sending, sent, failed o null.
- La API nunca devuelve códigos ni PIN. Vercode los envía al email del destinatario; no diseñes el cliente esperando esos campos.
- Conserva el código de error y el mensaje de respuestas no exitosas, sin filtrar headers o secretos a logs o al cliente.

Pruebas y entrega:
- Añade pruebas unitarias para autenticación, timeout, errores, paginación e idempotencia.
- Simula todas las respuestas HTTP. No hagas llamadas reales desde los tests.
- Incluye casos para reintento con la misma Idempotency-Key, 409, 429, 5xx y los estados no finales.
- Entrega un resumen de archivos modificados, variables de entorno necesarias y comandos para ejecutar las pruebas.
- Si falta una decisión funcional que cambie el contrato público, detente y pregúntame antes de asumirla.`;
}

export function aiIntegrationPromptSamples(baseUrl: string): CodeSample[] {
    return [
        { label: 'Node.js / TypeScript', code: aiIntegrationPrompt(baseUrl, 'typescript') },
        { label: 'Python', code: aiIntegrationPrompt(baseUrl, 'python') },
        { label: 'Otro stack', code: aiIntegrationPrompt(baseUrl, 'other') },
    ];
}
