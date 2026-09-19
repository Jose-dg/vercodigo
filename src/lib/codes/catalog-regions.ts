/**
 * Infer USA vs Colombia for Buy Codes catalog items.
 * There is no `region` column in Prisma; region comes from currency + name cues.
 */

export type BuyRegion = "US" | "CO";

export interface CatalogDenomination {
    id: string;
    amount: number;
    currency: string;
    devDiemProductId: string | null;
}

export interface CatalogProduct {
    id: string;
    name: string;
    brand: string;
    category?: string | null;
    isActive: boolean;
    devDiemProductId: string | null;
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

const COLOMBIA_NAME_RE = /\b(colombia|colombiano|cop)\b/i;
const USA_NAME_RE = /\b(usa|united states|us\$|usd)\b/i;

function primaryCurrency(product: CatalogProduct): string | null {
    const currencies = product.denominations.map((d) => d.currency.toUpperCase());
    if (currencies.length === 0) return null;
    const cop = currencies.filter((c) => c === "COP").length;
    const usd = currencies.filter((c) => c === "USD").length;
    if (cop > usd) return "COP";
    if (usd > cop) return "USD";
    return currencies[0] ?? null;
}

/** Resolve region for a purchasable product. */
export function resolveProductRegion(product: CatalogProduct): BuyRegion {
    const name = product.name;
    if (COLOMBIA_NAME_RE.test(name) && !USA_NAME_RE.test(name)) return "CO";
    if (USA_NAME_RE.test(name) && !COLOMBIA_NAME_RE.test(name)) return "US";

    const currency = primaryCurrency(product);
    if (currency === "COP") return "CO";
    if (currency === "USD") return "US";

    // Fallback: Colombia brands in seeds are COP-first; Steam/PlayStation USD → US
    const brand = product.brand.toLowerCase();
    if (brand === "xbox" || brand === "free fire" || brand === "netflix") return "CO";
    return "US";
}

export function filterProductsByRegion(
    products: CatalogProduct[],
    region: BuyRegion,
): CatalogProduct[] {
    return products.filter((p) => resolveProductRegion(p) === region);
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
