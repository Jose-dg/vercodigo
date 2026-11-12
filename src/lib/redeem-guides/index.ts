import { defaultLocale, locales, localeTags, type Locale } from "../i18n/config.ts";
import { es } from "./content/es.ts";
import { guideDefinitions } from "./definitions.ts";
import type { GuideContent, GuideId, Guide } from "./types.ts";

export type { Guide, GuideContent, GuideId } from "./types.ts";

const contentByLocale: Record<Locale, Partial<Record<GuideId, GuideContent>>> = { es };

/** Base path of the public guides for each language. */
const GUIDES_BASE: Record<Locale, string> = { es: "/guias" };

function contentFor(id: GuideId, locale: Locale): GuideContent {
    return contentByLocale[locale][id] ?? contentByLocale[defaultLocale][id]!;
}

function build(id: GuideId, locale: Locale): Guide {
    return { ...guideDefinitions[id], content: contentFor(id, locale) };
}

const MATCH_ORDER = (Object.keys(guideDefinitions) as GuideId[]).filter((id) => id !== "generic");

/**
 * Guide for a card's product. Matches the brand first, then the product name,
 * and falls back to the generic guide so a card is never left without help.
 */
export function resolveGuide(
    product: { brand?: string | null; name?: string | null },
    locale: Locale = defaultLocale,
): Guide {
    for (const field of [product.brand, product.name]) {
        const value = (field ?? "").toLowerCase();
        if (!value) continue;
        const id = MATCH_ORDER.find((candidate) =>
            guideDefinitions[candidate].keywords.some((keyword) => value.includes(keyword)));
        if (id) return build(id, locale);
    }
    return build("generic", locale);
}

/** Guides with a public page in that language, in display order. */
export function publicGuides(locale: Locale = defaultLocale): Guide[] {
    return MATCH_ORDER
        .filter((id) => guideDefinitions[id].slugs[locale])
        .map((id) => build(id, locale));
}

export function guideBySlug(locale: Locale, slug: string): Guide | null {
    const id = MATCH_ORDER.find((candidate) => guideDefinitions[candidate].slugs[locale] === slug);
    return id ? build(id, locale) : null;
}

export function guidesIndexPath(locale: Locale): string {
    return locale === defaultLocale ? GUIDES_BASE[locale] : `/${locale}${GUIDES_BASE[locale]}`;
}

/** Public path of a guide, or null when it has no page in that language. */
export function guidePath(guide: Pick<Guide, "slugs">, locale: Locale): string | null {
    const slug = guide.slugs[locale];
    return slug ? `${guidesIndexPath(locale)}/${slug}` : null;
}

/**
 * hreflang map for a guide (or the index when no guide is given): only the
 * languages that really have the page, plus x-default on the default one.
 */
export function guideAlternates(guide?: Pick<Guide, "slugs">): Record<string, string> {
    const alternates: Record<string, string> = {};
    for (const locale of locales) {
        const path = guide ? guidePath(guide, locale) : guidesIndexPath(locale);
        if (path) alternates[localeTags[locale]] = path;
    }
    const fallback = guide ? guidePath(guide, defaultLocale) : guidesIndexPath(defaultLocale);
    if (fallback) alternates["x-default"] = fallback;
    return alternates;
}
