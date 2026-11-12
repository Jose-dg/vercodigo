/**
 * Languages of the public end-customer pages (/scan and /guias). Only Spanish
 * ships today; adding one means adding it here, its dictionary and the guide
 * translations. Kept free of app imports so tests can load it directly.
 */
export const locales = ["es"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "es";

/** BCP 47 tag used in `lang`, Open Graph and hreflang. */
export const localeTags: Record<Locale, string> = {
    es: "es",
};

export function isLocale(value: string): value is Locale {
    return (locales as readonly string[]).includes(value);
}

/**
 * Picks the best supported locale from an Accept-Language header or a list
 * such as `navigator.languages`, falling back to the default.
 */
export function negotiateLocale(preferred: string | readonly string[] | null | undefined): Locale {
    const tags = typeof preferred === "string"
        ? preferred
            .split(",")
            .map((part) => {
                const [tag, ...params] = part.trim().split(";");
                const q = params.find((p) => p.trim().startsWith("q="));
                return { tag, q: q ? Number(q.trim().slice(2)) : 1 };
            })
            .filter((entry) => entry.tag && entry.q > 0)
            .sort((a, b) => b.q - a.q)
            .map((entry) => entry.tag)
        : [...(preferred ?? [])];
    for (const tag of tags) {
        const base = tag.toLowerCase().split("-")[0];
        if (isLocale(base)) return base;
    }
    return defaultLocale;
}
