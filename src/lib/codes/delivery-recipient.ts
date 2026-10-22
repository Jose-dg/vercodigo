/**
 * Delivery to the buyer's own customer ("enviar al email de mi cliente").
 *
 * Diem sends the email (managed_and_partner) and owns its state; diem-sas keeps
 * no copy. The recipient lives in the frozen command (diemRequestSnapshot) and
 * the delivery state in fulfillmentStatus, mirrored from Diem's webhook.
 */

export type DeliveryRecipient = {
    firstName: string;
    lastName: string;
    email: string;
};

export type RecipientDeliveryState = "sending" | "sent" | "failed";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_NAME = 100;
const MAX_EMAIL = 254;

export class InvalidDeliveryRecipientError extends Error {}

export function normalizeDeliveryRecipient(input: {
    firstName?: unknown;
    lastName?: unknown;
    email?: unknown;
}): DeliveryRecipient {
    const text = (value: unknown) => (typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "");
    const firstName = text(input.firstName);
    const lastName = text(input.lastName);
    const email = text(input.email).toLowerCase();
    if (!firstName) throw new InvalidDeliveryRecipientError("El nombre del destinatario es obligatorio");
    if (firstName.length > MAX_NAME || lastName.length > MAX_NAME) {
        throw new InvalidDeliveryRecipientError(`El nombre admite máximo ${MAX_NAME} caracteres`);
    }
    if (email.length > MAX_EMAIL || !EMAIL_PATTERN.test(email)) {
        throw new InvalidDeliveryRecipientError(`El email "${email}" no es válido`);
    }
    return { firstName, lastName, email };
}

export function sameDeliveryRecipient(
    left: DeliveryRecipient | null,
    right: DeliveryRecipient | null,
): boolean {
    if (!left || !right) return left === right;
    return left.email === right.email
        && left.firstName === right.firstName
        && left.lastName === right.lastName;
}

/** The customer Diem emails, or null when the buyer only reads the codes. */
export function deliveryRecipientOf(snapshot: unknown): DeliveryRecipient | null {
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return null;
    const body = (snapshot as Record<string, unknown>).body;
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    const { delivery_mode: mode, recipient } = body as Record<string, unknown>;
    if (mode !== "managed_and_partner") return null;
    if (!recipient || typeof recipient !== "object" || Array.isArray(recipient)) return null;
    const row = recipient as Record<string, unknown>;
    if (typeof row.email !== "string" || !row.email) return null;
    return {
        firstName: typeof row.first_name === "string" ? row.first_name : "",
        lastName: typeof row.last_name === "string" ? row.last_name : "",
        email: row.email,
    };
}

/**
 * Email state from Diem's request status. For managed_and_partner Diem only
 * reaches "delivered" once the provider accepted the email; action_required
 * after allocation means the email failed and needs Diem's team.
 */
export function recipientDeliveryState(fulfillmentStatus: string | null): RecipientDeliveryState | null {
    switch (fulfillmentStatus) {
        case "delivered":
            return "sent";
        case "action_required":
        case "failed":
        case "cancelled":
            return "failed";
        case null:
        case undefined:
        case "":
            return null;
        default:
            return "sending";
    }
}
