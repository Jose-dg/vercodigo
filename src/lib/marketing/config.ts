export type MarketingCatalogItem = {
  name: string;
  status: "available" | "coming_soon";
};

function parseCatalog(value?: string): MarketingCatalogItem[] {
  if (!value) return [];

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [name, rawStatus] = entry.split(":").map((part) => part.trim());
      return {
        name,
        status: rawStatus === "coming_soon" ? "coming_soon" : "available",
      };
    });
}

const whatsappNumber = process.env.NEXT_PUBLIC_VERCODE_WHATSAPP?.replace(/\D/g, "") ?? "";
const whatsappMessage = encodeURIComponent(
  "Hola, quiero conocer cómo abrir una cuenta para mi empresa.",
);

export const marketingConfig = {
  brand: {
    name: "Vercode",
    canonicalUrl:
      process.env.NEXT_PUBLIC_MARKETING_URL ?? "https://vercode.me",
    description:
      "Códigos digitales y tarjetas con QR para vender en tiendas y empresas.",
  },
  market: {
    countryCode: "CO",
    locale: "es-CO",
    currency: "COP",
  },
  contact: {
    email: process.env.NEXT_PUBLIC_VERCODE_CONTACT_EMAIL ?? "",
    supportHours: process.env.NEXT_PUBLIC_VERCODE_SUPPORT_HOURS ?? "",
    whatsappUrl: whatsappNumber
      ? `https://wa.me/${whatsappNumber}?text=${whatsappMessage}`
      : "#solicitar-cuenta",
    linkedinUrl: process.env.NEXT_PUBLIC_VERCODE_LINKEDIN ?? "",
    schedulingUrl: process.env.NEXT_PUBLIC_VERCODE_SCHEDULING_URL ?? "",
  },
  company: {
    legalName: process.env.NEXT_PUBLIC_VERCODE_LEGAL_NAME ?? "",
    taxId: process.env.NEXT_PUBLIC_VERCODE_TAX_ID ?? "",
    address: process.env.NEXT_PUBLIC_VERCODE_ADDRESS ?? "",
  },
  urls: {
    login: "/login",
    redemptionBasePath: "/scan",
  },
  catalog: parseCatalog(process.env.NEXT_PUBLIC_VERCODE_CATALOG),
} as const;

export const hasConfiguredLegalIdentity = Boolean(
  marketingConfig.company.legalName &&
    marketingConfig.company.taxId &&
    marketingConfig.company.address,
);
