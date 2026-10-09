import type { CommercialPurchaseOrigin } from "../devdiem/fulfillment.ts";

export type PurchaseOriginSource = {
    storeId: string | null;
    purchaseOriginPhoneId: string | null;
    originLabelSnapshot: string | null;
    purchaseOriginPhone: { phone: string } | null;
};

/**
 * The single wire representation of a purchase origin shared with Diem:
 * a phone, a store, or null for "no specific phone or store". Diem validates
 * exactly this shape (apps/fulfillment/purchase_origin.py).
 */
export function purchaseOriginSnapshot(purchase: PurchaseOriginSource): CommercialPurchaseOrigin | null {
    if (purchase.purchaseOriginPhoneId) {
        return {
            kind: "phone",
            id: purchase.purchaseOriginPhoneId,
            label: purchase.originLabelSnapshot,
            phone: purchase.purchaseOriginPhone?.phone ?? null,
        };
    }
    if (purchase.storeId) {
        return {
            kind: "store",
            id: purchase.storeId,
            label: purchase.originLabelSnapshot,
        };
    }
    return null;
}
