/**
 * Public API v1 shapes (snake_case). A delivery never carries its codes: Diem
 * emails them to the recipient, so a leaked key cannot pull PINs out.
 */
import { deliveryRecipientOf, recipientDeliveryState } from "../../lib/codes/delivery-recipient.ts";

const PUBLIC_STATUS: Record<string, string> = {
    PENDING: "processing",
    FINALIZING: "processing",
    AWAITING_STOCK: "awaiting_stock",
    COMPLETED: "completed",
    ACTION_REQUIRED: "action_required",
    FAILED: "failed",
};

export function publicDeliveryStatus(status: string): string {
    return PUBLIC_STATUS[status] ?? "processing";
}

export type DeliverySource = {
    id: string;
    status: string;
    productId: string;
    productName?: string;
    denominationId: string | null;
    count: number;
    totalAmount: number;
    currency: string;
    diemRequestSnapshot?: unknown;
    fulfillmentStatus?: string | null;
    createdAt: Date | string;
    completedAt?: Date | string | null;
};

const iso = (value: Date | string | null | undefined) =>
    value == null ? null : new Date(value).toISOString();

export function serializeDelivery(purchase: DeliverySource) {
    const recipient = deliveryRecipientOf(purchase.diemRequestSnapshot);
    return {
        id: purchase.id,
        object: "delivery" as const,
        livemode: true,
        status: publicDeliveryStatus(purchase.status),
        product: { id: purchase.productId, name: purchase.productName ?? null },
        denomination_id: purchase.denominationId,
        quantity: purchase.count,
        total: { amount: purchase.totalAmount, currency: purchase.currency },
        recipient: recipient
            ? { first_name: recipient.firstName, last_name: recipient.lastName, email: recipient.email }
            : null,
        email_delivery: recipient ? recipientDeliveryState(purchase.fulfillmentStatus ?? null) : null,
        created_at: iso(purchase.createdAt),
        completed_at: iso(purchase.completedAt),
    };
}

export type SandboxDeliverySource = {
    id: string;
    status: string;
    productId: string;
    denominationId: string | null;
    quantity: number;
    unitAmount: number;
    currency: string;
    recipientFirstName: string;
    recipientLastName: string;
    recipientEmail: string;
    emailDelivery: string | null;
    createdAt: Date | string;
    completedAt: Date | string | null;
};

/** Same public shape as a real delivery, flagged livemode=false. */
export function serializeSandboxDelivery(row: SandboxDeliverySource, productName?: string | null) {
    return {
        id: row.id,
        object: "delivery" as const,
        livemode: false,
        status: row.status,
        product: { id: row.productId, name: productName ?? null },
        denomination_id: row.denominationId,
        quantity: row.quantity,
        total: { amount: row.unitAmount * row.quantity, currency: row.currency },
        recipient: { first_name: row.recipientFirstName, last_name: row.recipientLastName, email: row.recipientEmail },
        email_delivery: row.emailDelivery,
        created_at: iso(row.createdAt),
        completed_at: iso(row.completedAt),
    };
}

export type CatalogQuote = {
    productId: string;
    denominationId: string | null;
    nominalAmount: number | null;
    salePrice: number;
    currency: string;
};

export type CatalogProduct = {
    id: string;
    name: string;
    brand: string;
    category: string | null;
    denominations: { id: string; amount: number; currency: string; countryRegion: string | null }[];
};

/** One row per purchasable product/denomination at this company's price. */
export function serializeCatalog(products: CatalogProduct[], quotes: CatalogQuote[]) {
    const byId = new Map(products.map((product) => [product.id, product]));
    return quotes.flatMap((quote) => {
        const product = byId.get(quote.productId);
        if (!product) return [];
        const denomination = product.denominations.find((row) => row.id === quote.denominationId) ?? null;
        return [{
            product_id: product.id,
            denomination_id: quote.denominationId,
            name: product.name,
            brand: product.brand,
            category: product.category,
            face_value: denomination ? { amount: denomination.amount, currency: denomination.currency } : null,
            region: denomination?.countryRegion ?? null,
            unit_price: { amount: quote.salePrice, currency: quote.currency },
        }];
    });
}
