export type DocsNavItem = { title: string; url: string; requiresKeyAccess?: boolean };
export type DocsNavSection = { title: string; items: DocsNavItem[] };

/** Documentation sections (sidebar-03 groups). Also feeds the breadcrumb. */
export const DOCS_NAV: DocsNavSection[] = [
    {
        title: "Empezar",
        items: [
            { title: "Introducción", url: "/developers" },
            { title: "Integrar con IA", url: "/developers/ai-integration" },
            { title: "Base URL", url: "/developers/base-url" },
            { title: "Autenticación", url: "/developers/authentication" },
            { title: "Paginación", url: "/developers/pagination" },
            { title: "Sandbox (pruebas)", url: "/developers/sandbox" },
            { title: "Idempotencia", url: "/developers/idempotency" },
            { title: "Errores y límites", url: "/developers/errors" },
        ],
    },
    {
        title: "Catálogo y precios",
        items: [
            { title: "Catálogo", url: "/developers/catalog" },
            { title: "Rates", url: "/developers/rates" },
        ],
    },
    {
        title: "Transacciones",
        items: [
            { title: "Listar transacciones", url: "/developers/transactions/list" },
            { title: "Obtener una transacción", url: "/developers/transactions/retrieve" },
        ],
    },
    {
        title: "Órdenes",
        items: [
            { title: "Crear una orden", url: "/developers/orders/create" },
            { title: "Listar órdenes", url: "/developers/orders/list" },
            { title: "Obtener una orden", url: "/developers/orders/retrieve" },
            { title: "Estados de orden", url: "/developers/orders/statuses" },
        ],
    },
    {
        title: "Cuenta",
        items: [
            { title: "Saldo", url: "/developers/wallet" },
            { title: "API keys", url: "/developers/api-keys", requiresKeyAccess: true },
        ],
    },
];

export function docsLocation(pathname: string) {
    for (const section of DOCS_NAV) {
        const item = section.items.find((entry) => entry.url === pathname);
        if (item) return { section: section.title, title: item.title };
    }
    return null;
}
