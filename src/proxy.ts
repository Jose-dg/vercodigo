import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

const PLATFORM_ROLES = new Set(["SUPER_ADMIN", "SYSTEM_ADMIN"]);
const COMPANY_ADMIN_ROLES = new Set(["OWNER", "GENERAL_ADMIN"]);
const STORE_ADMIN_ROLES = new Set(["ADMIN"]);

function startsWithAny(path: string, prefixes: string[]) {
    return prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export default withAuth(
    function proxy(req) {
        const role = String(req.nextauth.token?.role ?? "");
        const path = req.nextUrl.pathname;
        const isPlatform = PLATFORM_ROLES.has(role);
        const isCompanyAdmin = COMPANY_ADMIN_ROLES.has(role);
        const isStoreAdmin = STORE_ADMIN_ROLES.has(role);
        const fallback = isPlatform ? "/admin" : isCompanyAdmin ? "/overview" : "/codes/purchase";

        if (startsWithAny(path, ["/admin", "/products", "/wallets", "/qr", "/cards", "/batches", "/keys", "/analytics"]) && !isPlatform) {
            return NextResponse.redirect(new URL(fallback, req.url));
        }
        if (startsWithAny(path, ["/companies"]) && !isPlatform && !isCompanyAdmin) {
            return NextResponse.redirect(new URL(fallback, req.url));
        }
        if (startsWithAny(path, ["/store", "/users", "/prices", "/costs"]) && !isPlatform && !isCompanyAdmin && !isStoreAdmin) {
            return NextResponse.redirect(new URL(fallback, req.url));
        }
        return NextResponse.next();
    },
    {
        callbacks: { authorized: ({ token }) => Boolean(token) },
        pages: { signIn: "/login" },
    },
);

export const config = {
    matcher: [
        "/admin/:path*", "/companies/:path*", "/store/:path*", "/products/:path*",
        "/users/:path*", "/wallets/:path*", "/prices/:path*", "/costs/:path*",
        "/qr/:path*", "/cards/:path*", "/batches/:path*", "/keys/:path*", "/analytics/:path*",
    ],
};
