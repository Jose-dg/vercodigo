import { createHash } from "node:crypto";

export type StatementMovementType = "RECHARGE" | "CONSUMPTION" | "ADJUSTMENT" | "REFUND";

export type StatementMovement = {
    id: string;
    type: StatementMovementType;
    amount: number | string;
    balanceAfter: number | string;
    occurredAt: string;
    description: string;
    productDetail?: string | null;
    quantity?: number | null;
    unitPrice?: number | string | null;
};

export type StatementLineSnapshot = StatementMovement & {
    position: number;
    debit: string;
    credit: string;
    balanceAfter: string;
    unitPrice: string | null;
};

export type StatementFinancialSnapshot = {
    openingBalance: string;
    consumptions: string;
    recharges: string;
    refunds: string;
    adjustments: string;
    closingBalance: string;
    totalPending: string;
    creditBalance: string;
    lines: StatementLineSnapshot[];
};

const PLATFORM_ROLES = new Set(["SUPER_ADMIN", "SYSTEM_ADMIN"]);
const CLIENT_FINANCIAL_ROLES = new Set(["OWNER", "GENERAL_ADMIN"]);

export function canIssueAccountStatement(role: string): boolean {
    return PLATFORM_ROLES.has(role);
}

export function canReadAccountStatement(role: string, actorCompanyId: string | null, statementCompanyId: string): boolean {
    return PLATFORM_ROLES.has(role) || (
        CLIENT_FINANCIAL_ROLES.has(role) &&
        actorCompanyId !== null &&
        actorCompanyId === statementCompanyId
    );
}

function toCents(value: number | string): number {
    const numeric = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(numeric)) throw new Error("Invalid monetary value");
    return Math.round(numeric * 100);
}

function money(cents: number): string {
    return (cents / 100).toFixed(2);
}

/**
 * Builds a statement from signed wallet balances. The ledger remains the source
 * of truth: debit/credit is derived from each balance transition rather than
 * guessed from a transaction description.
 */
export function buildFinancialSnapshot(
    openingBalance: number | string,
    movements: StatementMovement[],
): StatementFinancialSnapshot {
    let previous = toCents(openingBalance);
    let consumptions = 0;
    let recharges = 0;
    let refunds = 0;
    let adjustments = 0;

    const lines = movements.map((movement, index): StatementLineSnapshot => {
        const next = toCents(movement.balanceAfter);
        const delta = next - previous;
        const debit = Math.max(0, -delta);
        const credit = Math.max(0, delta);

        switch (movement.type) {
            case "CONSUMPTION":
                consumptions += debit - credit;
                break;
            case "RECHARGE":
                recharges += credit - debit;
                break;
            case "REFUND":
                refunds += credit - debit;
                break;
            case "ADJUSTMENT":
                adjustments += delta;
                break;
        }

        previous = next;
        return {
            ...movement,
            position: index + 1,
            debit: money(debit),
            credit: money(credit),
            balanceAfter: money(next),
            unitPrice: movement.unitPrice == null ? null : money(toCents(movement.unitPrice)),
        };
    });

    const closing = movements.length > 0 ? previous : toCents(openingBalance);
    return {
        openingBalance: money(toCents(openingBalance)),
        consumptions: money(consumptions),
        recharges: money(recharges),
        refunds: money(refunds),
        adjustments: money(adjustments),
        closingBalance: money(closing),
        totalPending: money(Math.max(0, -closing)),
        creditBalance: money(Math.max(0, closing)),
        lines,
    };
}

export function statementFingerprint(value: unknown): string {
    return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function redactSensitiveCodes(value: string): string {
    return value
        .replace(/\b[A-Z0-9]{4}(?:-[A-Z0-9]{4}){2}\b/gi, "[código protegido]")
        .replace(/\b(?=[A-Z0-9]{8,20}\b)(?=[A-Z0-9]*[A-Z])(?=[A-Z0-9]*\d)[A-Z0-9]+\b/gi, "[código protegido]");
}

export function hasProvisionalTaxId(taxId: string): boolean {
    const normalized = taxId.replace(/[^0-9]/g, "");
    return (
        normalized.length < 8 ||
        normalized === "1234567" ||
        normalized === "123456789" ||
        /^(\d)\1+$/.test(normalized)
    );
}

export function statementBalanceLabel(closingBalance: number | string): {
    label: "Total pendiente" | "Saldo a favor" | "Saldo al día";
    amount: string;
} {
    const cents = toCents(closingBalance);
    if (cents < 0) return { label: "Total pendiente", amount: money(-cents) };
    if (cents > 0) return { label: "Saldo a favor", amount: money(cents) };
    return { label: "Saldo al día", amount: money(0) };
}
