/**
 * Buy Codes catalog families reconciled by scripts/reconcile-buy-codes-catalog.ts.
 * devDiemProductId is the Diem catalog product (StoreProduct of the SAS store).
 * Cost is the global COP debit; USD SKUs follow the platform rule USD × 3.600.
 */
export const COP_PER_USD = 3600;

export type CatalogDenominationSpec = {
    amount: number;
    currency: "USD" | "COP";
    devDiemProductId: string;
    cost: number;
};

export type CatalogProductSpec = {
    name: string;
    sku: string;
    brand: string;
    category: string;
    denominations: readonly CatalogDenominationSpec[];
};

function usd(amount: number, devDiemProductId: string): CatalogDenominationSpec {
    return { amount, currency: "USD", devDiemProductId, cost: amount * COP_PER_USD };
}

function cop(amount: number, devDiemProductId: string): CatalogDenominationSpec {
    return { amount, currency: "COP", devDiemProductId, cost: amount };
}

function single(name: string, sku: string, brand: string, denomination: CatalogDenominationSpec): CatalogProductSpec {
    return { name, sku, brand, category: "Gift Card Digital", denominations: [denomination] };
}

export const GOOGLE_PLAY_CATALOG: readonly CatalogProductSpec[] = [
    {
        name: "Google Play Colombia",
        sku: "GPLAY-CO",
        brand: "Google Play",
        category: "Gift Card Digital",
        denominations: [
            cop(10000, "9ee29aab-ac2f-5e23-8f79-87cd85158d54"),
            cop(30000, "6847cee6-b8fd-5cbb-b69c-1ea586aa588f"),
            cop(50000, "8d6f710a-1353-5b80-a3f7-74de3c2b0b7a"),
        ],
    },
];

export const NINTENDO_CATALOG: readonly CatalogProductSpec[] = [
    single("Nintendo 5", "B01M0YDV8M", "Nintendo", usd(5, "e309a39b-b5bf-4c8d-ac85-023a3ce86a60")),
    single("Nintendo eShop $10", "799366445838", "Nintendo", usd(10, "497fb7af-9e72-4c68-900c-8c1b5c91daef")),
    single("Nintendo eShop $20", "799366104667", "Nintendo", usd(20, "92d97f5a-c816-4425-8d44-ff6cfb7a3f75")),
    single("Nintendo eShop $35", "799366445852", "Nintendo", usd(35, "3fdf13cc-c0a6-4ccf-9b8d-97608dfedcdd")),
    single("Nintendo eShop $45", "400059001469", "Nintendo", usd(45, "1369d3ff-aee3-4a40-814e-31922c1e3ff7")),
    single("Nintendo eShop $50", "B01M1VX5UJ", "Nintendo", usd(50, "e827bb27-61c9-4061-a759-9114f42143aa")),
    single("Nintendo eShop $65", "B0BQVYQH2P", "Nintendo", usd(65, "2ed20e13-56fa-425e-8063-db84ceda198d")),
    single("Nintendo eShop $70", "400059002015", "Nintendo", usd(70, "76332e78-c4a7-41b2-841e-55d26678f347")),
    single("Nintendo eShop $100", "196742047066", "Nintendo", usd(100, "830167ab-134c-4f64-b202-76fb2ede7fc4")),
    single("Nintendo Switch Online 3 Meses", "799366646747", "Nintendo", usd(10, "7aafcc45-4324-4c9a-830c-851fa5d8fc7a")),
    single("Nintendo Switch Online 12 Meses", "799366630838", "Nintendo", usd(27, "f4e12aad-ab14-4b8f-b492-0329937a87ae")),
];

export const BUY_CODES_FAMILIES = {
    "google-play": GOOGLE_PLAY_CATALOG,
    nintendo: NINTENDO_CATALOG,
} as const satisfies Record<string, readonly CatalogProductSpec[]>;

export type BuyCodesFamily = keyof typeof BUY_CODES_FAMILIES;

export type CatalogProductRow = {
    name: string;
    brand: string;
    category: string | null;
    isActive: boolean;
    isGiftCard: boolean;
    devDiemProductId: string | null;
    denominations: ReadonlyArray<{ id: string; amount: number; currency: string; devDiemProductId: string | null }>;
    costs: ReadonlyArray<{ companyId: string | null; denominationId: string | null; cost: number; currency: string; isActive: boolean }>;
};

/** Differences between the spec and the stored SAS product; empty = in sync. */
export function catalogDrift(spec: CatalogProductSpec, row: CatalogProductRow | null): string[] {
    if (!row) return ["missing"];
    const drift: string[] = [];
    if (row.name !== spec.name) drift.push("name");
    if (row.brand !== spec.brand) drift.push("brand");
    if (row.category !== spec.category) drift.push("category");
    if (!row.isActive) drift.push("inactive");
    if (!row.isGiftCard) drift.push("isGiftCard");
    if (row.devDiemProductId !== null) drift.push("product-level devDiemProductId");
    for (const denomination of spec.denominations) {
        const label = `${denomination.amount} ${denomination.currency}`;
        const stored = row.denominations.find((item) => item.devDiemProductId === denomination.devDiemProductId);
        if (!stored) {
            drift.push(`${label}: missing denomination`);
            continue;
        }
        if (stored.amount !== denomination.amount || stored.currency !== denomination.currency) {
            drift.push(`${label}: amount/currency`);
        }
        const cost = row.costs.find((item) => item.companyId === null && item.denominationId === stored.id);
        if (!cost || !cost.isActive || cost.cost !== denomination.cost || cost.currency !== "COP") {
            drift.push(`${label}: global cost`);
        }
    }
    return drift;
}
