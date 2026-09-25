import type { MetadataRoute } from "next";

import { marketingConfig } from "@/lib/marketing/config";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = marketingConfig.brand.canonicalUrl.replace(/\/$/, "");
  return [
    { url: baseUrl, changeFrequency: "monthly", priority: 1 },
    { url: `${baseUrl}/empresas`, changeFrequency: "monthly", priority: 0.8 },
  ];
}
