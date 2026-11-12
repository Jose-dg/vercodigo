import type { MetadataRoute } from "next";

import { marketingConfig } from "@/lib/marketing/config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      // /scan/ stays crawlable on purpose so bots read its noindex (a Disallow
      // would hide the noindex and still let the URL be indexed from links).
      allow: ["/", "/empresas", "/guias", "/scan/"],
      disallow: ["/api/", "/admin/", "/analytics/", "/wallet/", "/wallets/", "/codes/", "/companies/", "/users/"],
    },
    sitemap: `${marketingConfig.brand.canonicalUrl.replace(/\/$/, "")}/sitemap.xml`,
  };
}
