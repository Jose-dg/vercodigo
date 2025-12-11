import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
    function middleware(req) {
        // Custom logic if needed, e.g. role based redirection
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
        "/store",
        "/store/:path*",
        "/api/qr/generate", // Protect sensitive API routes
    ],
};
