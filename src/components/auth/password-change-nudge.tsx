"use client";

import { useSyncExternalStore } from "react";
import { useClerk } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { KeyRound, X } from "lucide-react";

import { Button } from "@/components/ui/button";

const DISMISS_KEY = "vercode:password-nudge-dismissed";
const listeners = new Set<() => void>();

function readDismissed(): boolean {
    try {
        return window.sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
        return false;
    }
}

function dismiss() {
    try {
        window.sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
        // Sin almacenamiento: se oculta igual hasta recargar.
    }
    listeners.forEach((listener) => listener());
}

// No interrumpe donde el usuario está comprando o activando.
const QUIET_PATHS = ["/codes/purchase", "/activate"];

/**
 * Aviso discreto cuando la clave la asignó un admin. Nunca bloquea: se puede cerrar
 * y vuelve en la siguiente sesión del navegador hasta que el usuario la cambie en Clerk.
 */
export function PasswordChangeNudge() {
    const pathname = usePathname();
    const { openUserProfile } = useClerk();
    const dismissed = useSyncExternalStore(
        (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        readDismissed,
        () => true,
    );
    if (dismissed || QUIET_PATHS.some((path) => pathname.startsWith(path))) return null;

    return (
        <div role="status" className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <KeyRound className="size-4 shrink-0" aria-hidden="true" />
            <p className="flex-1">Por seguridad, cambia la contraseña que te asignamos por una tuya.</p>
            {/* Abre el perfil en Seguridad; al guardar, el webhook de Clerk apaga este aviso. */}
            <Button size="sm" variant="outline" className="h-8 bg-background" onClick={() => openUserProfile({ __experimental_startPath: "/security" })}>
                Cambiarla
            </Button>
            <Button type="button" size="icon" variant="ghost" className="size-8" aria-label="Recordármelo después" onClick={dismiss}>
                <X className="size-4" />
            </Button>
        </div>
    );
}
