"use client";

import { Settings2 } from "lucide-react";

import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

import { useSettingsDialog } from "./settings-dialog";

/** Entrada del menú lateral (al final, debajo de Operations) que abre el modal de Configuración. */
export function SettingsNavItem() {
    const { openSettings } = useSettingsDialog();
    return (
        <SidebarMenuItem>
            <SidebarMenuButton tooltip="Configuración" onClick={() => openSettings()}>
                <Settings2 aria-hidden="true" />
                <span>Configuración</span>
            </SidebarMenuButton>
        </SidebarMenuItem>
    );
}
