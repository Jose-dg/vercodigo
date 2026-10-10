import { calculateCompanyRateAmount } from "./company-rate.ts";

export interface ResolvedCost {
    amount: number;
    currency: string;
    source: "company_rate" | "company" | "global" | "denomination";
    sourceAmount?: number;
    sourceCurrency?: string;
    exchangeRate?: number;
}

export interface CostInputs {
    companyId: string;
    walletCurrency: string | null;
    /** Tasa COP/USD negociada para la compañía y el producto, si existe. */
    companyRateCopPerUsd: number | null;
    /** FX_USD_COP de plataforma; convierte costos USD a una wallet COP. */
    fallbackRateCopPerUsd: number | null;
    denomination: { amount: number; currency: string } | null;
    /** Costos activos del producto/denominación (de la compañía y globales). */
    costs: ReadonlyArray<{ companyId: string | null; cost: number; currency: string }>;
}

/**
 * Regla única del costo que se debita de la wallet. El cobro y la cotización
 * del checkout la comparten para que el total mostrado sea el que se cobra.
 * Precedencia: tarifa negociada (solo denominaciones USD en wallet COP) →
 * costo de la compañía → costo global → valor nominal de la denominación.
 */
export function computeCost(inputs: CostInputs): ResolvedCost | null {
    const walletCurrency = (inputs.walletCurrency ?? "COP").toUpperCase();
    const fallbackRate = inputs.fallbackRateCopPerUsd != null && inputs.fallbackRateCopPerUsd > 0
        ? inputs.fallbackRateCopPerUsd
        : null;
    const normalizeToWallet = (amount: number, currency: string): ResolvedCost => {
        if (currency.toUpperCase() === "USD" && walletCurrency === "COP" && fallbackRate != null) {
            return {
                amount: calculateCompanyRateAmount({ denominationUsd: amount, rateCopPerUsd: fallbackRate }).unitAmountCop,
                currency: "COP",
                source: "denomination",
                sourceAmount: amount,
                sourceCurrency: "USD",
                exchangeRate: fallbackRate,
            };
        }
        return { amount, currency, source: "denomination" };
    };

    const { denomination } = inputs;
    if (
        inputs.companyRateCopPerUsd != null
        && denomination
        && denomination.currency.toUpperCase() === "USD"
        && walletCurrency === "COP"
    ) {
        return {
            amount: calculateCompanyRateAmount({
                denominationUsd: denomination.amount,
                rateCopPerUsd: inputs.companyRateCopPerUsd,
            }).unitAmountCop,
            currency: "COP",
            source: "company_rate",
            sourceAmount: denomination.amount,
            sourceCurrency: "USD",
            exchangeRate: inputs.companyRateCopPerUsd,
        };
    }

    const companyCost = inputs.costs.find((cost) => cost.companyId === inputs.companyId);
    if (companyCost) return { ...normalizeToWallet(companyCost.cost, companyCost.currency), source: "company" };

    const globalCost = inputs.costs.find((cost) => cost.companyId === null);
    if (globalCost) return { ...normalizeToWallet(globalCost.cost, globalCost.currency), source: "global" };

    if (denomination) return normalizeToWallet(denomination.amount, denomination.currency);

    return null;
}
