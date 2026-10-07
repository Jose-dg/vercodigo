export function calculateCompanyRateAmount(params: {
    denominationUsd: number;
    rateCopPerUsd: number;
    quantity?: number;
}) {
    const quantity = params.quantity ?? 1;
    if (!(params.denominationUsd > 0) || !(params.rateCopPerUsd > 0) || !(quantity > 0)) {
        throw new Error("Los valores de la tarifa deben ser mayores a cero");
    }
    const unitAmountCop = Math.round(params.denominationUsd * params.rateCopPerUsd * 100) / 100;
    return {
        unitAmountCop,
        totalAmountCop: Math.round(unitAmountCop * quantity * 100) / 100,
    };
}
