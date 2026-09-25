import type { MetadataRoute } from "next";

import { marketingConfig } from "@/lib/marketing/config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/empresas", "/scan/"],
      disallow: ["/api/", "/admin/", "/analytics/", "/wallet/", "/wallets/", "/codes/", "/companies/", "/users/"],
    },
    sitemap: `${marketingConfig.brand.canonicalUrl.replace(/\/$/, "")}/sitemap.xml`,
  };
}
