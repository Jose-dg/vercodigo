import type { Metadata } from "next";

import { defaultLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

const dict = getDictionary(defaultLocale);

/**
 * End customers land here from the card's QR. The page shows a private PIN
 * and must stay out of search results and free of any distributor brand.
 * `X-Robots-Tag` (next.config.ts) covers the same; robots.txt keeps /scan/
 * crawlable so the noindex is actually read.
 */
export const metadata: Metadata = {
    title: { absolute: dict.scan.pageTitle },
    description: null,
    robots: { index: false, follow: false, nocache: true },
    // Replaces the whole parent `icons` (metadata merges per top-level key).
    icons: { icon: "/redeem-icon.svg" },
    manifest: null,
    appleWebApp: null,
    openGraph: null,
    twitter: null,
};

export default function ScanLayout({ children }: { children: React.ReactNode }) {
    return children;
}
