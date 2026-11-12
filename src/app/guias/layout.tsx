import type { Metadata } from "next";

import { defaultLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

const dict = getDictionary(defaultLocale);

/**
 * Public redemption guides: indexable, but neutral like /scan. No distributor
 * brand, header or footer, and no link back to the B2B site.
 */
export const metadata: Metadata = {
    title: { template: `%s · ${dict.guides.siteName}`, default: dict.guides.siteName },
    // Replaces the whole parent `icons` (metadata merges per top-level key).
    icons: { icon: "/redeem-icon.svg" },
    manifest: null,
    appleWebApp: null,
};

export default function GuidesLayout({ children }: { children: React.ReactNode }) {
    return <main className="redeem-page px-4 py-10 sm:py-16">{children}</main>;
}
