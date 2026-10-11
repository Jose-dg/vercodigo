/**
 * Effective time of wallet movements.
 *
 * `occurredAt` is when the movement happened (for a top-up: when the payment
 * was made or confirmed); `createdAt` is only when the row was written. Every
 * movement declares where its `occurredAt` comes from, so a registration time
 * is never presented as a payment time. Times are stored as UTC instants and
 * shown in Colombian time, the operating zone of every company.
 */

export type WalletTimeSource =
    | "LEDGER_EVENT"
    | "PAYMENT"
    | "GATEWAY_CONFIRMATION"
    | "SOURCE_SYSTEM"
    | "REGISTRATION_ONLY";

export const LEDGER_TIME_ZONE = "America/Bogota";
/** Colombia has no daylight saving time: its offset is constant. */
const BOGOTA_OFFSET = "-05:00";
/** Clock skew accepted between the payer's evidence and the server. */
export const EFFECTIVE_TIME_FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

export function formatLedgerDateTime(value: Date | string): string {
    return new Intl.DateTimeFormat("es-CO", {
        timeZone: LEDGER_TIME_ZONE,
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(value));
}

export function formatLedgerDate(value: Date | string): string {
    return new Intl.DateTimeFormat("es-CO", {
        timeZone: LEDGER_TIME_ZONE,
        day: "2-digit",
        month: "short",
        year: "numeric",
    }).format(new Date(value));
}

/** `YYYY-MM-DDTHH:mm` typed in Colombian time → ISO 8601 with its offset. */
export function bogotaLocalToIso(local: string): string {
    const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?$/.exec(local.trim());
    if (!match) throw new Error("Fecha y hora inválidas");
    const iso = `${match[1]}T${match[2]}:${match[3] ?? "00"}${BOGOTA_OFFSET}`;
    const instant = new Date(iso);
    // Date silently rolls over impossible dates (2026-02-31): reject them.
    if (Number.isNaN(instant.getTime()) || bogotaLocalNow(instant) !== `${match[1]}T${match[2]}`) {
        throw new Error("Fecha y hora inválidas");
    }
    return iso;
}

/** Colombian wall-clock time as `YYYY-MM-DDTHH:mm`, the format of a datetime-local input. */
export function bogotaLocalNow(now: Date = new Date()): string {
    const shifted = new Date(now.getTime() - 5 * 60 * 60 * 1000);
    return shifted.toISOString().slice(0, 16);
}

/**
 * Why an effective time is not acceptable, or null when it is: never in the
 * future beyond clock skew. There is no lower bound here: wallets are created
 * lazily, so a payment may precede its wallet row; issued periods are guarded
 * by the closed-period rule instead.
 */
export function effectiveTimeProblem(params: { occurredAt: Date; now: Date }): string | null {
    const time = params.occurredAt.getTime();
    if (Number.isNaN(time)) return "La fecha del pago es inválida";
    if (time > params.now.getTime() + EFFECTIVE_TIME_FUTURE_TOLERANCE_MS) {
        return "La fecha del pago no puede estar en el futuro";
    }
    return null;
}

/**
 * Qualifier shown next to the time of a movement. null for ordinary ledger
 * events, whose time needs no explanation.
 */
export function effectiveTimeLabel(source: WalletTimeSource, createdAt: Date | string): string | null {
    switch (source) {
        case "PAYMENT":
            return "Hora del pago";
        case "GATEWAY_CONFIRMATION":
            return "Pago confirmado por Diem";
        case "SOURCE_SYSTEM":
            return "Hora del sistema de origen";
        case "REGISTRATION_ONLY":
            return `Sin hora de pago · registrado el ${formatLedgerDateTime(createdAt)}`;
        default:
            return null;
    }
}

/** Bank references compare without case or spacing differences. */
export function normalizeBankReference(reference: string): string {
    return reference.trim().replace(/\s+/g, " ").toUpperCase();
}
