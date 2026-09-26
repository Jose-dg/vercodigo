/** Region filtering for Buy Codes, sourced from Diem's catalog. */

export type BuyRegion = "US" | "CO";

export interface CatalogDenomination {
    id: string;
    amount: number;
    currency: string;
    devDiemProductId: string | null;
    countryRegion?: string | null;
}

export interface CatalogProduct {
    id: string;
    name: string;
    brand: string;
    category?: string | null;
    isActive: boolean;
    devDiemProductId: string | null;
    countryRegion?: string | null;
    denominations: CatalogDenomination[];
}

export const REGION_META: Record<
    BuyRegion,
    {
        id: BuyRegion;
        label: string;
        shortLabel: string;
        flag: string;
        currencyHint: string;
        description: string;
    }
> = {
    US: {
        id: "US",
        label: "Estados Unidos",
        shortLabel: "USA",
        flag: "🇺🇸",
        currencyHint: "USD",
        description: "Gift cards y wallets en dólares",
    },
    CO: {
        id: "CO",
        label: "Colombia",
        shortLabel: "Colombia",
        flag: "🇨🇴",
        currencyHint: "COP",
        description: "Códigos y recargas en pesos",
    },
};

function mapCountryRegion(countryRegion?: string | null): BuyRegion | null {
    const normalized = String(countryRegion || "").trim().toLowerCase();
    if (normalized === "colombia") return "CO";
    if (normalized === "united_states") return "US";
    return null;
}

export function productRegions(product: CatalogProduct): BuyRegion[] {
    const regions = new Set<BuyRegion>();
    const productRegion = mapCountryRegion(product.countryRegion);
    if (productRegion) regions.add(productRegion);
    for (const denomination of product.denominations) {
        const denominationRegion = mapCountryRegion(denomination.countryRegion);
        if (denominationRegion) regions.add(denominationRegion);
    }
    return Array.from(regions);
}

export function filterProductsByRegion(
    products: CatalogProduct[],
    region: BuyRegion,
): CatalogProduct[] {
    return products.flatMap((product) => {
        const productRegion = mapCountryRegion(product.countryRegion);
        const denominations = product.denominations.filter(
            (denomination) => mapCountryRegion(denomination.countryRegion) === region,
        );
        if (product.denominations.length > 0 && denominations.length === 0) return [];
        if (product.denominations.length === 0 && productRegion !== region) return [];
        return [{ ...product, denominations }];
    });
}

export function brandsInRegion(
    products: CatalogProduct[],
    region: BuyRegion,
): string[] {
    const brands = new Set(
        filterProductsByRegion(products, region).map((p) => p.brand),
    );
    return Array.from(brands).sort((a, b) => a.localeCompare(b, "es"));
}

export function filterProductsByRegionAndBrand(
    products: CatalogProduct[],
    region: BuyRegion,
    brand: string,
): CatalogProduct[] {
    return filterProductsByRegion(products, region)
        .filter((p) => p.brand === brand)
        .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

/** Brand-specific accent for tile UI (not product logos). */
export function brandAccent(brand: string): { bg: string; fg: string; ring: string } {
    const key = brand.toLowerCase();
    if (key.includes("steam")) {
        return { bg: "bg-sky-950", fg: "text-sky-100", ring: "ring-sky-700" };
    }
    if (key.includes("playstation") || key === "psn" || key.includes("sony")) {
        return { bg: "bg-blue-700", fg: "text-white", ring: "ring-blue-500" };
    }
    if (key.includes("xbox") || key.includes("microsoft")) {
        return { bg: "bg-emerald-700", fg: "text-white", ring: "ring-emerald-500" };
    }
    if (key.includes("free fire") || key.includes("garena")) {
        return { bg: "bg-orange-600", fg: "text-white", ring: "ring-orange-400" };
    }
    if (key.includes("netflix")) {
        return { bg: "bg-red-700", fg: "text-white", ring: "ring-red-500" };
    }
    return { bg: "bg-slate-800", fg: "text-slate-100", ring: "ring-slate-500" };
}

export function formatDenomAmount(amount: number, currency: string): string {
    try {
        return new Intl.NumberFormat(currency === "COP" ? "es-CO" : "en-US", {
            style: "currency",
            currency,
            maximumFractionDigits: currency === "COP" ? 0 : 2,
        }).format(amount);
    } catch {
        return `${amount.toLocaleString("es-CO")} ${currency}`;
    }
}
