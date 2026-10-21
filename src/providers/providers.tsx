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
            appearance={{
                theme: shadcn,
                // El tema shadcn de Clerk espera variables con el color completo (shadcn en
                // Tailwind v4: `--card: oklch(…)`). Aquí son tripletas HSL de Tailwind v3
                // (`--card: 0 0% 100%`): sin hsl() el color es inválido y el modal queda
                // transparente. --color-black y --font-weight-* tampoco existen en v3.
                variables: {
                    colorBackground: "hsl(var(--card))",
                    colorDanger: "hsl(var(--destructive))",
                    colorForeground: "hsl(var(--card-foreground))",
                    colorInput: "hsl(var(--input))",
                    colorInputForeground: "hsl(var(--card-foreground))",
                    colorModalBackdrop: "rgb(0 0 0 / 0.5)",
                    colorMuted: "hsl(var(--muted))",
                    colorMutedForeground: "hsl(var(--muted-foreground))",
                    colorNeutral: "hsl(var(--foreground))",
                    colorPrimary: "hsl(var(--primary))",
                    colorPrimaryForeground: "hsl(var(--primary-foreground))",
                    colorRing: "hsl(var(--ring) / 0.5)",
                    fontWeight: { normal: 400, medium: 500, semibold: 600, bold: 600 },
                },
            }}
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
