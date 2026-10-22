export type DocsNavItem = { title: string; url: string; requiresKeyAccess?: boolean };
export type DocsNavSection = { title: string; items: DocsNavItem[] };

/** Documentation sections (sidebar-03 groups). Also feeds the breadcrumb. */
export const DOCS_NAV: DocsNavSection[] = [
    {
        title: "Empezar",
        items: [
            { title: "Introducción", url: "/developers" },
            { title: "Autenticación", url: "/developers/authentication" },
            { title: "Sandbox (pruebas)", url: "/developers/sandbox" },
            { title: "Idempotencia", url: "/developers/idempotency" },
            { title: "Errores y límites", url: "/developers/errors" },
        ],
    },
    {
        title: "API",
        items: [
            { title: "Catálogo", url: "/developers/catalog" },
            { title: "Crear entrega", url: "/developers/deliveries/create" },
            { title: "Consultar entrega", url: "/developers/deliveries/retrieve" },
            { title: "Saldo", url: "/developers/wallet" },
        ],
    },
    {
        title: "Cuenta",
        items: [{ title: "API keys", url: "/developers/api-keys", requiresKeyAccess: true }],
    },
];

export function docsLocation(pathname: string) {
    for (const section of DOCS_NAV) {
        const item = section.items.find((entry) => entry.url === pathname);
        if (item) return { section: section.title, title: item.title };
    }
    return null;
}
