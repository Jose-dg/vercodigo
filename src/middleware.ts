// import { withAuth } from "next-auth/middleware"; // Temporalmente deshabilitado
import { NextResponse, type NextRequest } from "next/server";

// Autenticación deshabilitada temporalmente para el deploy.
// El código original está comentado debajo para futura restauración.
export function middleware(req: NextRequest) {
    return NextResponse.next();
}

/*
// --- Código de Autenticación Original ---
import { withAuth } from "next-auth/middleware";

export default withAuth(
    function middleware(req) {
        // Lógica personalizada si es necesario, ej: redirección por rol
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
*/

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
        "/api/qr/generate", // Proteger rutas de API sensibles
    ],
};
