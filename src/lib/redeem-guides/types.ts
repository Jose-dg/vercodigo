export type GuideId =
    | "playstation"
    | "xbox"
    | "nintendo"
    | "steam"
    | "roblox"
    | "netflix"
    | "google-play"
    | "razer-gold"
    | "free-fire"
    | "generic";

/** Whether the account holder can move their own account to another region. */
export type RegionChange = "yes" | "limited" | "no";

/** Translatable text of one guide. */
export type GuideContent = {
    /** Platform name as people search it ("PlayStation"). */
    name: string;
    metaTitle: string;
    metaDescription: string;
    intro: string;
    redeemLabel: string;
    steps: string[];
    region: {
        summary: string;
        /** Extra steps when the account is from another region. */
        otherRegionSteps: string[];
    };
    faqs: Array<{ question: string; answer: string }>;
};

/** Language-independent facts of one guide. */
export type GuideDefinition = {
    id: GuideId;
    /** Lowercase fragments matched against `Product.brand` / name. */
    keywords: string[];
    /** Public URL slug per language; absent = no public page (generic guide). */
    slugs: Partial<Record<string, string>>;
    redeemUrl: string | null;
    /** The code only works on an account of the card's region. */
    regionLocked: boolean;
    regionChange: RegionChange;
    sources: Array<{ label: string; url: string }>;
    /** ISO date of the last content review (sitemap lastModified). */
    updatedAt: string;
};

export type Guide = GuideDefinition & { content: GuideContent };
