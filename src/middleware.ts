import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
    function middleware(req) {
        const token = req.nextauth.token;
        const path = req.nextUrl.pathname;
        const isPlatform = token && ["SUPER_ADMIN", "SYSTEM_ADMIN"].includes(token.role as string);

        const platformOnlyPaths = ["/qr", "/cards", "/batches", "/keys"];
        if (platformOnlyPaths.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
            if (!isPlatform) {
                return NextResponse.redirect(new URL("/", req.url));
            }
        }

        // Role-based access control for analytics
        if (path.startsWith("/analytics") || path.startsWith("/api/analytics")) {
            if (!isPlatform) {
                return NextResponse.redirect(new URL("/login", req.url));
            }
        }

        return NextResponse.next();
    },
    {
        callbacks: {
            authorized: ({ token }) => !!token,
        },
        pages: {
            signIn: "/login",
        },
    }
);

export const config = {
    matcher: [
        "/admin",
        "/admin/:path*",
        "/products",
        "/products/:path*",
        "/qr",
        "/qr/:path*",
        "/cards/:path*",
        "/batches/:path*",
        "/keys/:path*",
        "/store",
        "/store/:path*",
        "/dashboard/analytics/:path*",
        "/api/analytics/:path*",
        "/api/qr/generate",
        "/api/cards/activate",
    ],
};
