import { calculateCompanyRateAmount } from "./company-rate.ts";
import { TRM_PRICED_REGION } from "./trm.ts";

export interface ResolvedCost {
    amount: number;
    currency: string;
    source: "trm" | "company" | "global" | "denomination";
    sourceAmount?: number;
    sourceCurrency?: string;
    exchangeRate?: number;
}

export interface CostInputs {
    companyId: string;
    walletCurrency: string | null;
    /**
     * Tasa mayorista COP/USD del día (TRM redondeada + margen). null si no hay TRM
     * disponible: la denominación conserva su costo configurado.
     */
    usdWholesaleRateCopPerUsd: number | null;
    /** FX_USD_COP de plataforma; convierte costos USD a una wallet COP. */
    fallbackRateCopPerUsd: number | null;
    /** countryRegion: región del catálogo de Diem; solo "united_states" se cobra con la TRM. */
    denomination: { amount: number; currency: string; countryRegion?: string | null } | null;
    /** Costos activos del producto/denominación (de la compañía y globales). */
    costs: ReadonlyArray<{ companyId: string | null; cost: number; currency: string }>;
}

/**
 * Regla única del costo que se debita de la wallet. El cobro y la cotización
 * del checkout la comparten para que el total mostrado sea el que se cobra.
 * Precedencia: TRM del día (solo denominaciones USD de región USA en wallet COP)
 * → costo de la compañía → costo global → valor nominal de la denominación.
 */
export function computeCost(inputs: CostInputs): ResolvedCost | null {
    const cost = resolveCostRule(inputs);
    // Cents are the unit Diem reconciles (unit × quantity === total) and the
    // wallet debits; quote, debit and the Diem order all start from this value.
    return cost ? { ...cost, amount: Math.round(cost.amount * 100) / 100 } : null;
}

function resolveCostRule(inputs: CostInputs): ResolvedCost | null {
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
    const wholesaleRate = inputs.usdWholesaleRateCopPerUsd;
    if (
        wholesaleRate != null
        && wholesaleRate > 0
        && denomination
        && denomination.currency.toUpperCase() === "USD"
        && denomination.countryRegion === TRM_PRICED_REGION
        && walletCurrency === "COP"
    ) {
        return {
            amount: calculateCompanyRateAmount({
                denominationUsd: denomination.amount,
                rateCopPerUsd: wholesaleRate,
            }).unitAmountCop,
            currency: "COP",
            source: "trm",
            sourceAmount: denomination.amount,
            sourceCurrency: "USD",
            exchangeRate: wholesaleRate,
        };
    }

    const companyCost = inputs.costs.find((cost) => cost.companyId === inputs.companyId);
    if (companyCost) return { ...normalizeToWallet(companyCost.cost, companyCost.currency), source: "company" };

    const globalCost = inputs.costs.find((cost) => cost.companyId === null);
    if (globalCost) return { ...normalizeToWallet(globalCost.cost, globalCost.currency), source: "global" };

    if (denomination) return normalizeToWallet(denomination.amount, denomination.currency);

    return null;
}
