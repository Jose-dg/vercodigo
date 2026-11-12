import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { defaultLocale, localeTags } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { guideAlternates, guidePath, guidesIndexPath, publicGuides } from "@/lib/redeem-guides";
import { absoluteUrl } from "@/lib/redeem-guides/site";

const locale = defaultLocale;
const dict = getDictionary(locale);

export const metadata: Metadata = {
    title: { absolute: dict.guides.indexTitle },
    description: dict.guides.indexDescription,
    alternates: { canonical: guidesIndexPath(locale), languages: guideAlternates() },
    openGraph: {
        type: "website",
        title: dict.guides.indexTitle,
        description: dict.guides.indexDescription,
        url: absoluteUrl(guidesIndexPath(locale)),
        locale: localeTags[locale],
        siteName: dict.guides.siteName,
    },
};

export default function GuidesIndexPage() {
    const guides = publicGuides(locale);
    return (
        <div className="mx-auto w-full max-w-2xl space-y-8">
            <header className="redeem-rise space-y-3">
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{dict.guides.indexHeading}</h1>
                <p className="max-w-xl leading-relaxed text-muted-foreground">{dict.guides.indexIntro}</p>
            </header>
            <ul className="redeem-rise grid gap-3 sm:grid-cols-2 [animation-delay:80ms]">
                {guides.map((guide) => (
                    <li key={guide.id}>
                        <Link
                            href={guidePath(guide, locale)!}
                            data-pressable
                            className="group flex h-full items-center justify-between gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted"
                        >
                            <span>
                                <span className="block font-medium">{guide.content.name}</span>
                                <span className="mt-1 block text-sm text-muted-foreground">{guide.content.intro}</span>
                            </span>
                            <ArrowRight
                                aria-hidden="true"
                                className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                            />
                            <span className="sr-only">{dict.guides.readGuide}</span>
                        </Link>
                    </li>
                ))}
            </ul>
        </div>
    );
}
