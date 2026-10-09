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

export function walletPurchaseDescription(count: number, productName: string): string {
    return `Compra de ${count} código(s) ${productName}`;
}

export function walletPurchaseOriginDescription(input: {
    phone?: string | null;
    label?: string | null;
    storeName?: string | null;
}): string | null {
    const phone = input.phone?.trim();
    const label = input.label?.trim();
    if (phone) return `Número: ${phone}${label && label !== phone ? ` · ${label}` : ""}`;
    const store = label || input.storeName?.trim();
    return store ? `Sede: ${store}` : null;
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
