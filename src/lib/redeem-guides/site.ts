import { marketingConfig } from "@/lib/marketing/config";

/** Absolute URL for canonical links and JSON-LD of the public guides. */
export function absoluteUrl(path: string): string {
    return `${marketingConfig.brand.canonicalUrl.replace(/\/$/, "")}${path}`;
}
