import type { MetadataRoute } from "next";

import { locales } from "@/lib/i18n/config";
import { guideAlternates, guidePath, guidesIndexPath, publicGuides } from "@/lib/redeem-guides";
import { marketingConfig } from "@/lib/marketing/config";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = marketingConfig.brand.canonicalUrl.replace(/\/$/, "");
  const absolute = (map: Record<string, string>) =>
    Object.fromEntries(Object.entries(map).map(([lang, path]) => [lang, `${baseUrl}${path}`]));

  // /scan/* is never listed: one private URL per card, served with noindex.
  const guides = locales.flatMap((locale) => {
    const items = publicGuides(locale);
    const lastModified = items.map((guide) => guide.updatedAt).sort().at(-1);
    return [
      {
        url: `${baseUrl}${guidesIndexPath(locale)}`,
        lastModified,
        changeFrequency: "monthly" as const,
        priority: 0.7,
        alternates: { languages: absolute(guideAlternates()) },
      },
      ...items.map((guide) => ({
        url: `${baseUrl}${guidePath(guide, locale)}`,
        lastModified: guide.updatedAt,
        changeFrequency: "monthly" as const,
        priority: 0.6,
        alternates: { languages: absolute(guideAlternates(guide)) },
      })),
    ];
  });

  return [
    { url: baseUrl, changeFrequency: "monthly", priority: 1 },
    { url: `${baseUrl}/empresas`, changeFrequency: "monthly", priority: 0.8 },
    ...guides,
  ];
}
