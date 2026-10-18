/**
 * Avisos por correo de pedidos (compras de códigos y activaciones QR). Reglas
 * puras: qué aviso recibe cada destinatario según el estado de la orden. El envío
 * lo hace diem-ai (eventos de scheduling con dispatch "now"); aquí no hay red.
 */

export type OrderNotificationTemplate =
    | "order_received"
    | "order_received_admin"
    | "order_ready"
    | "order_action_required"
    | "order_action_required_admin";

export type RecipientRole = "buyer" | "company_admin" | "diem_team";

export type NotificationRecipient = {
    /** Estable por destinatario: id de usuario o "team:<correo>". Forma parte del external_ref. */
    key: string;
    email: string;
    name: string;
    role: RecipientRole;
};

export type OrderAggregateType = "CodePurchase" | "ActivationJob";

export type OrderFacts = {
    aggregateType: OrderAggregateType;
    id: string;
    status: string;
    /** true solo en la solicitud que crea la orden. */
    created: boolean;
    orderNumber: string;
    itemSummary: string;
    total: string;
    companyName: string;
    buyerName: string;
    orderUrl: string;
    /** Motivo técnico (lastError): solo para el equipo y los admins, nunca para el comprador. */
    internalReason: string | null;
};

export type OrderNotification = {
    template: OrderNotificationTemplate;
    recipient: NotificationRecipient;
    /** Idempotencia en diem-ai: el mismo aviso para el mismo destinatario nunca se envía dos veces. */
    externalRef: string;
    params: Record<string, string>;
};

const ATTENTION_STATUSES = new Set(["ACTION_REQUIRED", "FAILED"]);

const STATUS_LABELS: Record<string, string> = {
    PENDING: "En proceso",
    PROCESSING: "En proceso",
    AWAITING_STOCK: "En espera de stock",
    FINALIZING: "En proceso",
    COMPLETED: "Entregado",
    ACTION_REQUIRED: "Requiere atención",
    FAILED: "Fallido",
};

const BUYER_ATTENTION_REASON = "Diem necesita revisarlo antes de entregar los códigos.";

export function statusLabel(status: string): string {
    return STATUS_LABELS[status] ?? status;
}

export function notificationExternalRef(
    template: OrderNotificationTemplate,
    aggregateType: OrderAggregateType,
    id: string,
    recipientKey: string,
): string {
    return `sas:${template}:${aggregateType}:${id}:${recipientKey}`.slice(0, 255);
}

export type ParsedExternalRef = {
    template: OrderNotificationTemplate;
    aggregateType: OrderAggregateType;
    id: string;
    recipientKey: string;
};

/** Inverso de notificationExternalRef, para registrar la confirmación de diem-ai. */
export function parseNotificationExternalRef(value: string | null | undefined): ParsedExternalRef | null {
    const parts = (value ?? "").split(":");
    if (parts.length < 5 || parts[0] !== "sas") return null;
    const [, template, aggregateType, id, ...rest] = parts;
    if (aggregateType !== "CodePurchase" && aggregateType !== "ActivationJob") return null;
    if (!id || rest.length === 0) return null;
    return {
        template: template as OrderNotificationTemplate,
        aggregateType,
        id,
        recipientKey: rest.join(":"),
    };
}

/** Un destinatario por correo (sin mayúsculas ni espacios): nadie recibe el mismo aviso dos veces. */
function uniqueByEmail(recipients: NotificationRecipient[]): NotificationRecipient[] {
    const seen = new Set<string>();
    return recipients.filter((recipient) => {
        const email = recipient.email.trim().toLowerCase();
        if (!email || seen.has(email)) return false;
        seen.add(email);
        return true;
    });
}

/**
 * Avisos que corresponden al estado actual de la orden:
 * - creada: el equipo y los admins de la empresa reciben "nuevo pedido";
 * - el comprador: "listo" si está COMPLETED, "requiere atención" si está en
 *   ACTION_REQUIRED/FAILED, y "recibido" solo al crearla abierta (si nace lista,
 *   recibe un solo correo);
 * - en atención, el equipo recibe además el detalle técnico.
 * Repetir la llamada con el mismo estado es inofensivo: el external_ref es el mismo.
 */
export function buildOrderNotifications(input: {
    facts: OrderFacts;
    buyer: NotificationRecipient | null;
    companyAdmins: NotificationRecipient[];
    team: NotificationRecipient[];
}): OrderNotification[] {
    const { facts } = input;
    const completed = facts.status === "COMPLETED";
    const attention = ATTENTION_STATUSES.has(facts.status);
    const base = {
        order_number: facts.orderNumber,
        item_summary: facts.itemSummary,
        total: facts.total,
        order_url: facts.orderUrl,
        company_name: facts.companyName,
        buyer_name: facts.buyerName,
    };
    const notifications: OrderNotification[] = [];
    const push = (template: OrderNotificationTemplate, recipient: NotificationRecipient, params: Record<string, string>) => {
        notifications.push({
            template,
            recipient,
            externalRef: notificationExternalRef(template, facts.aggregateType, facts.id, recipient.key),
            params: { ...base, customer_name: recipient.name, ...params },
        });
    };

    const buyerEmail = input.buyer?.email.trim().toLowerCase() ?? null;
    const staff = uniqueByEmail([...input.companyAdmins, ...input.team])
        .filter((recipient) => recipient.email.trim().toLowerCase() !== buyerEmail);

    if (facts.created) {
        for (const recipient of staff) {
            push("order_received_admin", recipient, { status_label: statusLabel(facts.status) });
        }
    }

    if (input.buyer) {
        if (completed) {
            push("order_ready", input.buyer, {});
        } else if (attention) {
            push("order_action_required", input.buyer, { reason: BUYER_ATTENTION_REASON });
        } else if (facts.created) {
            push("order_received", input.buyer, {});
        }
    }

    if (attention) {
        for (const recipient of uniqueByEmail(input.team).filter((r) => r.email.trim().toLowerCase() !== buyerEmail)) {
            push("order_action_required_admin", recipient, {
                reason: facts.internalReason?.slice(0, 300) || statusLabel(facts.status),
            });
        }
    }

    return notifications;
}

/** Lista de correos del equipo Diem (SystemConfig NOTIFY_ORDER_EMAILS: separados por coma o salto de línea). */
export function parseTeamEmails(raw: string | null | undefined): NotificationRecipient[] {
    return uniqueByEmail(
        (raw ?? "")
            .split(/[\s,;]+/)
            .map((value) => value.trim().toLowerCase())
            .filter((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
            .map((email) => ({ key: `team:${email}`, email, name: "Equipo Diem", role: "diem_team" as const })),
    );
}
