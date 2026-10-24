"use client";

import { useEffect } from "react";
import { useClerk } from "@clerk/nextjs";

import { SETTINGS_PARAM } from "./params";

/**
 * `/settings` redirige al inicio con `?configuracion`: aquí se abre el perfil de Clerk
 * y se quita el parámetro, para que recargar no lo vuelva a abrir.
 */
export function OpenProfileFromUrl() {
    const { loaded, openUserProfile } = useClerk();

    useEffect(() => {
        if (!loaded) return;
        const url = new URL(window.location.href);
        if (!url.searchParams.has(SETTINGS_PARAM)) return;
        url.searchParams.delete(SETTINGS_PARAM);
        window.history.replaceState(null, "", url.pathname + url.search + url.hash);
        openUserProfile({ __experimental_startPath: "/security" });
    }, [loaded, openUserProfile]);

    return null;
}
