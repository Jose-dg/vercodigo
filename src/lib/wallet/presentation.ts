type WalletMovementPresentationInput = {
    description: string | null;
    externalReference: string | null;
    historicalAction?: "Buy" | "Payment" | null;
    historicalBuyerName?: string | null;
};

export function walletMovementDescription(input: WalletMovementPresentationInput): string {
    if (input.historicalAction && input.historicalBuyerName) {
        return `${input.historicalAction} - ${input.historicalBuyerName}`;
    }
    return input.description ?? input.externalReference ?? "—";
}

export function formatWalletRunningBalance(balance: number, currency: string): string {
    const amount = new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(Math.abs(balance));

    return `${amount} ${currency}`;
}
