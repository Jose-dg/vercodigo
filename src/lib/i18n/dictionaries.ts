import type { Locale } from "./config.ts";

/** Card region as the catalog stores it (`ProductDenomination.countryRegion`). */
export type CardRegion = "united_states" | "colombia" | "global";

export type Dictionary = {
    regions: Record<CardRegion, string>;
    scan: {
        pageTitle: string;
        loading: string;
        yourCode: string;
        copy: string;
        copied: string;
        openRedeemSite: string;
        scansLeft: (count: number) => string;
        keepItSafe: string;
        regionBadge: (region: string) => string;
        regionMustMatch: (region: string) => string;
        howToRedeem: string;
        fullGuide: string;
        notActivatedTitle: string;
        notActivatedBody: string;
        storeLabel: string;
        limitTitle: string;
        limitBody: string;
        notFoundTitle: string;
        notFoundBody: string;
        genericErrorTitle: string;
        genericErrorBody: string;
        retry: string;
    };
    guides: {
        siteName: string;
        indexTitle: string;
        indexDescription: string;
        indexHeading: string;
        indexIntro: string;
        breadcrumbHome: string;
        stepsHeading: string;
        regionHeading: string;
        regionCanChange: Record<"yes" | "limited" | "no", string>;
        changeRegionHeading: string;
        faqHeading: string;
        regionQuestion: (platform: string) => string;
        sourcesHeading: string;
        redeemAt: string;
        updatedAt: (date: string) => string;
        readGuide: string;
    };
};

const es: Dictionary = {
    regions: {
        united_states: "Estados Unidos",
        colombia: "Colombia",
        global: "Global",
    },
    scan: {
        pageTitle: "Tu código",
        loading: "Cargando tu código…",
        yourCode: "Tu código",
        copy: "Copiar código",
        copied: "Código copiado",
        openRedeemSite: "Ir a canjear",
        scansLeft: (count) =>
            count === 1 ? "Puedes abrir esta página 1 vez más." : `Puedes abrir esta página ${count} veces más.`,
        keepItSafe: "Guarda el código en un lugar seguro y no lo compartas con nadie.",
        regionBadge: (region) => `Región: ${region}`,
        regionMustMatch: (region) =>
            `Esta tarjeta es de ${region}. Tu cuenta debe ser de ${region} o el código no funcionará.`,
        howToRedeem: "Cómo canjearlo",
        fullGuide: "Ver la guía completa",
        notActivatedTitle: "Tu tarjeta aún no está activa",
        notActivatedBody: "Pídele a la tienda donde la compraste que la active. Después vuelve a escanear el QR.",
        storeLabel: "Tienda",
        limitTitle: "Ya no se puede mostrar el código",
        limitBody: "Esta tarjeta llegó al límite de veces que se puede ver. Si no guardaste el código, contacta a la tienda donde la compraste.",
        notFoundTitle: "No encontramos esta tarjeta",
        notFoundBody: "Revisa que escaneaste el QR completo de la tarjeta.",
        genericErrorTitle: "No pudimos cargar tu código",
        genericErrorBody: "Revisa tu conexión e inténtalo de nuevo.",
        retry: "Intentar de nuevo",
    },
    guides: {
        siteName: "Guías de canje",
        indexTitle: "Guías para canjear tarjetas de regalo y elegir la región correcta",
        indexDescription:
            "Paso a paso para canjear tarjetas de PlayStation, Xbox, Nintendo, Steam, Roblox, Netflix, Google Play, Razer Gold y Free Fire, y qué hacer con la región de tu cuenta.",
        indexHeading: "Guías de canje",
        indexIntro:
            "Elige tu plataforma para ver cómo canjear el código, en qué región funciona y si puedes cambiar la región de tu cuenta.",
        breadcrumbHome: "Guías",
        stepsHeading: "Paso a paso",
        regionHeading: "Región de la tarjeta",
        regionCanChange: {
            yes: "La región de la cuenta se puede cambiar.",
            limited: "La región de la cuenta se puede cambiar, con condiciones.",
            no: "La región de la cuenta no se puede cambiar.",
        },
        changeRegionHeading: "Si tu cuenta es de otra región",
        faqHeading: "Preguntas frecuentes",
        regionQuestion: (platform) => `¿Funciona una tarjeta de ${platform} de otra región?`,
        sourcesHeading: "Fuentes oficiales",
        redeemAt: "Canjear en",
        updatedAt: (date) => `Actualizada el ${date}`,
        readGuide: "Ver guía",
    },
};

const dictionaries: Record<Locale, Dictionary> = { es };

export function getDictionary(locale: Locale): Dictionary {
    return dictionaries[locale];
}

export function regionLabel(locale: Locale, region: string | null | undefined): string | null {
    const key = (region ?? "").trim().toLowerCase() as CardRegion;
    return getDictionary(locale).regions[key] ?? null;
}
