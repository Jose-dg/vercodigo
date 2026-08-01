type DenominationLike = {
    id: string;
    amount: number;
    devDiemProductId: string | null;
};

type ProductLike = {
    devDiemProductId: string | null;
    denominations: DenominationLike[];
};

type CardLike = {
    denomination: DenominationLike | null;
    customAmount: number | null;
    product: ProductLike;
};

export function resolveCardDenomination(card: CardLike): DenominationLike | null {
    if (card.denomination) return card.denomination;

    const denominations = card.product.denominations.filter(
        (item) => item.devDiemProductId,
    );
    if (denominations.length === 1) return denominations[0];

    if (card.customAmount != null) {
        const match = card.product.denominations.find(
            (item) => item.amount === card.customAmount,
        );
        if (match) return match;
    }

    return null;
}

export function resolveDevDiemProductId(card: CardLike): string | null {
    const denomination = resolveCardDenomination(card);
    return denomination?.devDiemProductId ?? card.product.devDiemProductId ?? null;
}
