import { NextRequest, NextResponse } from 'next/server';

const AUTH_COOKIE_PREFIXES = [
    'next-auth.',
    '__Secure-next-auth.',
    '__Host-next-auth.',
    'authjs.',
    '__Secure-authjs.',
    '__Host-authjs.',
];

export async function POST(request: NextRequest) {
    const response = NextResponse.json({ success: true });

    // El botón usa signOut() de NextAuth, que también invalida la sesión del
    // lado del framework. Esta ruta queda como respaldo para clientes que
    // necesiten cerrar sesión por API y limpia tanto cookies estándar como
    // cookies seguras o fragmentadas.
    for (const cookie of request.cookies.getAll()) {
        if (
            cookie.name === 'auth-token'
            || AUTH_COOKIE_PREFIXES.some((prefix) => cookie.name.startsWith(prefix))
        ) {
            response.cookies.set(cookie.name, '', {
                httpOnly: true,
                secure: cookie.name.startsWith('__Secure-') || cookie.name.startsWith('__Host-'),
                sameSite: 'lax',
                maxAge: 0,
                expires: new Date(0),
                path: '/',
            });
        }
    }

    return response;
}
