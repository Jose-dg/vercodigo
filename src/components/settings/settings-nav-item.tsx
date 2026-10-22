"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings2 } from "lucide-react";

import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

/** Entrada del menú lateral hacia Configuración: perfil, sedes, usuarios y precios. */
export function SettingsNavItem() {
    const pathname = usePathname();
    return (
        <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Configuración" isActive={pathname.startsWith("/settings")}>
                <Link href="/settings">
                    <Settings2 aria-hidden="true" />
                    <span>Configuración</span>
                </Link>
            </SidebarMenuButton>
        </SidebarMenuItem>
    );
}
