"use client";

import { useClerk } from "@clerk/nextjs";
import { Settings2 } from "lucide-react";

import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

/** Entrada del menú lateral (al final, debajo de Operations) que abre el perfil de Clerk. */
export function SettingsNavItem() {
    const { openUserProfile } = useClerk();
    return (
        <SidebarMenuItem>
            <SidebarMenuButton tooltip="Configuración" onClick={() => openUserProfile()}>
                <Settings2 aria-hidden="true" />
                <span>Configuración</span>
            </SidebarMenuButton>
        </SidebarMenuItem>
    );
}
