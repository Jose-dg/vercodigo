"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { esMX } from "@clerk/localizations";
import { shadcn } from "@clerk/ui/themes";

/**
 * Identidad con Clerk (contraseña, Google, Apple, recuperación y sesiones). La
 * autorización (rol, empresa, sede) sigue en nuestra base: ver src/lib/auth/actor.ts.
 */
export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <ClerkProvider
            appearance={{ theme: shadcn }}
            localization={esMX}
            signInUrl="/login"
            // Sin destino pedido (enlace de un correo, ruta protegida), cada rol va a su inicio.
            signInFallbackRedirectUrl="/auth/continue"
            afterSignOutUrl="/login"
        >
            {children}
        </ClerkProvider>
    );
}
