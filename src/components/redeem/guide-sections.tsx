import { AlertTriangle, ExternalLink } from "lucide-react";

import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Guide } from "@/lib/redeem-guides";

/** Numbered steps of a guide. `headingLevel` keeps one h1 per page. */
export function GuideSteps({
    guide,
    heading,
    headingLevel = "h2",
}: {
    guide: Guide;
    heading: string;
    headingLevel?: "h2" | "h3";
}) {
    const Heading = headingLevel;
    return (
        <section className="space-y-3">
            <Heading className="text-lg font-semibold tracking-tight">{heading}</Heading>
            <ol className="space-y-3">
                {guide.content.steps.map((step, index) => (
                    <li key={step} className="flex gap-3">
                        <span
                            aria-hidden="true"
                            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--redeem-accent))] text-xs font-semibold text-white"
                        >
                            {index + 1}
                        </span>
                        <span className="leading-relaxed text-muted-foreground">{step}</span>
                    </li>
                ))}
            </ol>
        </section>
    );
}

/**
 * The region rule. When the card's region is known it leads with a direct
 * warning ("this card is from X, your account must be from X").
 */
export function GuideRegion({
    guide,
    dict,
    cardRegion,
    headingLevel = "h2",
}: {
    guide: Guide;
    dict: Dictionary;
    cardRegion?: string | null;
    headingLevel?: "h2" | "h3";
}) {
    const Heading = headingLevel;
    const SubHeading = headingLevel === "h2" ? "h3" : "h4";
    const showCardWarning = Boolean(cardRegion && guide.regionLocked && cardRegion !== dict.regions.global);
    return (
        <section className="space-y-3">
            <Heading className="text-lg font-semibold tracking-tight">{dict.guides.regionHeading}</Heading>
            {showCardWarning && (
                <p className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm font-medium">
                    <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    {dict.scan.regionMustMatch(cardRegion!)}
                </p>
            )}
            <p className="leading-relaxed text-muted-foreground">{guide.content.region.summary}</p>
            <p className="text-sm font-medium">{dict.guides.regionCanChange[guide.regionChange]}</p>
            {guide.content.region.otherRegionSteps.length > 0 && (
                <div className="space-y-2">
                    <SubHeading className="text-sm font-semibold">{dict.guides.changeRegionHeading}</SubHeading>
                    <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
                        {guide.content.region.otherRegionSteps.map((step) => (
                            <li key={step}>{step}</li>
                        ))}
                    </ul>
                </div>
            )}
        </section>
    );
}

export function GuideFaqs({ guide, dict }: { guide: Guide; dict: Dictionary }) {
    if (!guide.content.faqs.length) return null;
    return (
        <section className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight">{dict.guides.faqHeading}</h2>
            <div className="divide-y rounded-lg border">
                {guide.content.faqs.map((faq) => (
                    <details key={faq.question} className="group p-4">
                        <summary className="cursor-pointer list-none font-medium marker:hidden">
                            {faq.question}
                        </summary>
                        <p className="mt-2 leading-relaxed text-muted-foreground">{faq.answer}</p>
                    </details>
                ))}
            </div>
        </section>
    );
}

export function GuideSources({ guide, dict }: { guide: Guide; dict: Dictionary }) {
    if (!guide.sources.length) return null;
    return (
        <section className="space-y-2">
            <h2 className="text-sm font-semibold">{dict.guides.sourcesHeading}</h2>
            <ul className="space-y-1 text-sm">
                {guide.sources.map((source) => (
                    <li key={source.url}>
                        <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-muted-foreground underline underline-offset-4 hover:text-foreground"
                        >
                            {source.label}
                            <ExternalLink aria-hidden="true" className="h-3 w-3" />
                        </a>
                    </li>
                ))}
            </ul>
        </section>
    );
}

/** Primary action: the official redemption site of the platform. */
export function RedeemSiteLink({ guide, label }: { guide: Guide; label: string }) {
    if (!guide.redeemUrl) return null;
    return (
        <a
            href={guide.redeemUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-pressable
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[hsl(var(--redeem-accent))] px-4 font-medium text-white transition-colors hover:bg-[hsl(var(--redeem-accent)/0.9)]"
        >
            {label}
            <span className="text-white/80">· {guide.content.redeemLabel}</span>
            <ExternalLink aria-hidden="true" className="h-4 w-4" />
        </a>
    );
}
