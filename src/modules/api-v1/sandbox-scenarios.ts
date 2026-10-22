/**
 * Sandbox outcomes are chosen by a tag in the recipient email, like test card
 * numbers: luis+fail@ejemplo.com simulates a failed email, and so on.
 */
export type SandboxScenario = {
    status: "completed" | "awaiting_stock" | "action_required";
    emailDelivery: "sent" | "failed" | null;
};

export const SANDBOX_SCENARIOS: { tag: string; description: string; scenario: SandboxScenario }[] = [
    { tag: "", description: "Entrega completada y email enviado", scenario: { status: "completed", emailDelivery: "sent" } },
    { tag: "+fail", description: "Entrega completada, pero el email falla", scenario: { status: "completed", emailDelivery: "failed" } },
    { tag: "+stock", description: "Sin inventario: queda esperando stock, sin cobro", scenario: { status: "awaiting_stock", emailDelivery: null } },
    { tag: "+review", description: "Queda en revisión manual, sin cobro", scenario: { status: "action_required", emailDelivery: null } },
];

export function sandboxScenario(email: string): SandboxScenario {
    const local = email.split("@")[0] ?? "";
    const match = SANDBOX_SCENARIOS.find((entry) => entry.tag && local.endsWith(entry.tag));
    return (match ?? SANDBOX_SCENARIOS[0]).scenario;
}
