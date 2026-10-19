import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { UserRole } from "@prisma/client";
import { homePathForRole } from "@/lib/auth/navigation";
import prisma from "@/lib/prisma";

const PLATFORM_ROLES = new Set(["SUPER_ADMIN", "SYSTEM_ADMIN"]);
const COMPANY_ADMIN_ROLES = new Set(["OWNER", "GENERAL_ADMIN"]);
const STORE_ADMIN_ROLES = new Set(["ADMIN"]);

const PLATFORM_PREFIXES = ["/admin", "/products", "/wallets", "/qr", "/cards", "/batches", "/keys", "/analytics"];
const COMPANY_ADMIN_PREFIXES = ["/companies"];
const STORE_ADMIN_PREFIXES = ["/store", "/users", "/prices", "/costs"];
const RESTRICTED_PREFIXES = [...PLATFORM_PREFIXES, ...COMPANY_ADMIN_PREFIXES, ...STORE_ADMIN_PREFIXES];

function startsWithAny(path: string, prefixes: string[]) {
    return prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/**
 * Clerk debe correr en toda solicitud donde se usa auth() (actor.ts en páginas y
 * APIs). Aquí solo se filtran las secciones por rol; la autoridad final es
 * getAuthenticatedActor, que lee rol, empresa y sede de la base en cada solicitud.
 * El proxy de Next 16 corre en Node, por eso puede consultar la base como respaldo.
 */
export default clerkMiddleware(async (auth, req) => {
    const path = req.nextUrl.pathname;
    if (!startsWithAny(path, RESTRICTED_PREFIXES)) return NextResponse.next();

    const { userId, sessionClaims, redirectToSignIn } = await auth();
    if (!userId) return redirectToSignIn({ returnBackUrl: req.url });

    // El rol viaja en la sesión (claim "metadata" configurado en Clerk). Si falta, se lee
    // de la base: un olvido en el dashboard no puede dejar a nadie sin sus secciones.
    let role = String((sessionClaims?.metadata as { role?: string } | undefined)?.role ?? "");
    if (!role) {
        const user = await prisma.user.findUnique({ where: { clerkUserId: userId }, select: { role: true } });
        role = user?.role ?? "";
    }
    if (!role) return NextResponse.redirect(new URL("/auth/continue", req.url));
    const isPlatform = PLATFORM_ROLES.has(role);
    const isCompanyAdmin = COMPANY_ADMIN_ROLES.has(role);
    const isStoreAdmin = STORE_ADMIN_ROLES.has(role);
    const fallback = homePathForRole(role as UserRole);

    if (startsWithAny(path, PLATFORM_PREFIXES) && !isPlatform) {
        return NextResponse.redirect(new URL(fallback, req.url));
    }
    if (startsWithAny(path, COMPANY_ADMIN_PREFIXES) && !isPlatform && !isCompanyAdmin) {
        return NextResponse.redirect(new URL(fallback, req.url));
    }
    if (startsWithAny(path, STORE_ADMIN_PREFIXES) && !isPlatform && !isCompanyAdmin && !isStoreAdmin) {
        return NextResponse.redirect(new URL(fallback, req.url));
    }
    return NextResponse.next();
}, {
    // Nuestro <SignIn /> en vez del portal hospedado de Clerk. También aplica al
    // redirectToSignIn() de las páginas (actor.ts), que lee estas opciones.
    signInUrl: "/login",
});

export const config = {
    matcher: [
        // Todo salvo internos de Next y archivos estáticos (matcher recomendado por Clerk).
        "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
        "/(api|trpc)(.*)",
    ],
};
