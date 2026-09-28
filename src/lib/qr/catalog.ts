import { RETIRED_STEAM_SKUS } from "../catalog/steam.ts";

export type QrDenomination = {
    id: string;
    amount: number;
    currency: string;
    devDiemProductId: string | null;
};

export type QrProduct = {
    id: string;
    name: string;
    sku: string;
    isActive: boolean;
    isGiftCard: boolean;
    devDiemProductId: string | null;
    denominations: QrDenomination[];
};

export type QrCatalogItem = {
    productId: string;
    denominationId: string;
    name: string;
    sku: string;
    amount: number;
    currency: string;
};

export type QrSelectionError =
    | "QR_PRODUCT_INACTIVE"
    | "QR_PRODUCT_NOT_ELIGIBLE"
    | "QR_DENOMINATION_INVALID"
    | "QR_MAPPING_MISSING"
    | "QR_CUSTOM_AMOUNT_NOT_ALLOWED";

const retiredSkus = new Set<string>(RETIRED_STEAM_SKUS);

export function isValidQrQuantity(quantity: unknown): quantity is number {
    return Number.isInteger(quantity) && Number(quantity) >= 1 && Number(quantity) <= 100;
}

function hasValidValue(denomination: QrDenomination): boolean {
    return Number.isFinite(denomination.amount)
        && denomination.amount > 0
        && denomination.currency.trim().length > 0;
}

function hasMapping(product: QrProduct, denomination: QrDenomination): boolean {
    return Boolean(denomination.devDiemProductId ?? product.devDiemProductId);
}

export function toQrCatalogItems(products: QrProduct[]): QrCatalogItem[] {
    return products
        .filter((product) => (
            product.isActive
            && product.isGiftCard
            && !retiredSkus.has(product.sku)
        ))
        .flatMap((product) => product.denominations
            .filter((denomination) => (
                hasValidValue(denomination) && hasMapping(product, denomination)
            ))
            .map((denomination) => ({
                productId: product.id,
                denominationId: denomination.id,
                name: product.name,
                sku: product.sku,
                amount: denomination.amount,
                currency: denomination.currency,
            })))
        .sort((left, right) => (
            left.name.localeCompare(right.name)
            || left.amount - right.amount
            || left.sku.localeCompare(right.sku)
        ));
}

export function resolveQrSelection(params: {
    product: QrProduct;
    denominationId?: unknown;
    customAmount?: unknown;
}): { ok: true; denomination: QrDenomination } | { ok: false; code: QrSelectionError } {
    const { product, denominationId, customAmount } = params;
    if (!product.isActive) return { ok: false, code: "QR_PRODUCT_INACTIVE" };
    if (!product.isGiftCard || retiredSkus.has(product.sku)) {
        return { ok: false, code: "QR_PRODUCT_NOT_ELIGIBLE" };
    }

    if (customAmount !== undefined) {
        return { ok: false, code: "QR_CUSTOM_AMOUNT_NOT_ALLOWED" };
    }
    if (typeof denominationId !== "string" || denominationId.length === 0) {
        return { ok: false, code: "QR_DENOMINATION_INVALID" };
    }
    const denomination = product.denominations.find((item) => item.id === denominationId);
    if (!denomination) return { ok: false, code: "QR_DENOMINATION_INVALID" };

    if (!hasValidValue(denomination)) {
        return { ok: false, code: "QR_DENOMINATION_INVALID" };
    }
    if (!hasMapping(product, denomination)) {
        return { ok: false, code: "QR_MAPPING_MISSING" };
    }

    return { ok: true, denomination };
}
