import { localeTags, type Locale } from "../i18n/config.ts";
import type { Guide } from "./types.ts";

/**
 * schema.org graph for a public guide page: the HowTo steps, the region
 * questions as FAQ, and the breadcrumb back to the guides index.
 */
export function guideStructuredData(params: {
    guide: Guide;
    locale: Locale;
    url: string;
    indexUrl: string;
    indexName: string;
    /** Localized question that introduces the region rule. */
    regionQuestion: string;
}) {
    const { guide, locale, url, indexUrl, indexName, regionQuestion } = params;
    const { content } = guide;
    const inLanguage = localeTags[locale];
    const faqs = [
        { question: regionQuestion, answer: content.region.summary },
        ...content.faqs,
    ];
    return {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "HowTo",
                "@id": `${url}#howto`,
                name: content.metaTitle,
                description: content.metaDescription,
                inLanguage,
                dateModified: guide.updatedAt,
                step: content.steps.map((text, index) => ({
                    "@type": "HowToStep",
                    position: index + 1,
                    text,
                })),
                ...(guide.redeemUrl ? { tool: { "@type": "HowToTool", name: content.redeemLabel } } : {}),
            },
            {
                "@type": "FAQPage",
                "@id": `${url}#faq`,
                inLanguage,
                mainEntity: faqs.map((faq) => ({
                    "@type": "Question",
                    name: faq.question,
                    acceptedAnswer: { "@type": "Answer", text: faq.answer },
                })),
            },
            {
                "@type": "BreadcrumbList",
                "@id": `${url}#breadcrumb`,
                itemListElement: [
                    { "@type": "ListItem", position: 1, name: indexName, item: indexUrl },
                    { "@type": "ListItem", position: 2, name: content.name, item: url },
                ],
            },
        ],
    };
}

/** Serializes JSON-LD for a <script> tag without letting content close it. */
export function serializeJsonLd(data: unknown): string {
    return JSON.stringify(data).replace(/</g, "\\u003c");
}
