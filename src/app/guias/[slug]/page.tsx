import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
    GuideFaqs,
    GuideRegion,
    GuideSources,
    GuideSteps,
    RedeemSiteLink,
} from "@/components/redeem/guide-sections";
import { defaultLocale, localeTags } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import {
    guideAlternates,
    guideBySlug,
    guidePath,
    guidesIndexPath,
    publicGuides,
} from "@/lib/redeem-guides";
import { absoluteUrl } from "@/lib/redeem-guides/site";
import { guideStructuredData, serializeJsonLd } from "@/lib/redeem-guides/structured-data";

const locale = defaultLocale;
const dict = getDictionary(locale);

export const dynamicParams = false;

export function generateStaticParams() {
    return publicGuides(locale).map((guide) => ({ slug: guide.slugs[locale]! }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const guide = guideBySlug(locale, (await params).slug);
    if (!guide) return {};
    const path = guidePath(guide, locale)!;
    return {
        title: { absolute: guide.content.metaTitle },
        description: guide.content.metaDescription,
        alternates: { canonical: path, languages: guideAlternates(guide) },
        openGraph: {
            type: "article",
            title: guide.content.metaTitle,
            description: guide.content.metaDescription,
            url: absoluteUrl(path),
            locale: localeTags[locale],
            siteName: dict.guides.siteName,
            modifiedTime: guide.updatedAt,
        },
        twitter: { card: "summary", title: guide.content.metaTitle, description: guide.content.metaDescription },
    };
}

function formatDate(iso: string) {
    return new Intl.DateTimeFormat(localeTags[locale], { dateStyle: "long", timeZone: "UTC" }).format(new Date(iso));
}

export default async function GuidePage({ params }: Props) {
    const guide = guideBySlug(locale, (await params).slug);
    if (!guide) notFound();
    const path = guidePath(guide, locale)!;
    const jsonLd = guideStructuredData({
        guide,
        locale,
        url: absoluteUrl(path),
        indexUrl: absoluteUrl(guidesIndexPath(locale)),
        indexName: dict.guides.breadcrumbHome,
        regionQuestion: dict.guides.regionQuestion(guide.content.name),
    });

    return (
        <article className="mx-auto w-full max-w-2xl space-y-10">
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />

            <header className="redeem-rise space-y-4">
                <nav aria-label="breadcrumb" className="text-sm text-muted-foreground">
                    <Link href={guidesIndexPath(locale)} className="underline-offset-4 hover:underline">
                        {dict.guides.breadcrumbHome}
                    </Link>
                    <span aria-hidden="true"> / </span>
                    <span aria-current="page">{guide.content.name}</span>
                </nav>
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{guide.content.metaTitle}</h1>
                <p className="leading-relaxed text-muted-foreground">{guide.content.intro}</p>
                <p className="text-xs text-muted-foreground">
                    <time dateTime={guide.updatedAt}>{dict.guides.updatedAt(formatDate(guide.updatedAt))}</time>
                </p>
            </header>

            <div className="redeem-rise space-y-10 [animation-delay:80ms]">
                <GuideSteps guide={guide} heading={dict.guides.stepsHeading} />
                <div className="max-w-sm">
                    <RedeemSiteLink guide={guide} label={dict.guides.redeemAt} />
                </div>
                <GuideRegion guide={guide} dict={dict} />
                <GuideFaqs guide={guide} dict={dict} />
                <GuideSources guide={guide} dict={dict} />
            </div>
        </article>
    );
}
