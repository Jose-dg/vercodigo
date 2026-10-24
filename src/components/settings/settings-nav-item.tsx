"use client";

import { useClerk } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, KeyRound, Settings2 } from "lucide-react";

import { useCurrentUser } from "@/components/auth/ability-context";
import { managementDestinationsForRole, type ManagementDestination } from "@/lib/auth/navigation";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
} from "@/components/ui/sidebar";

const SETTINGS_LINKS: { destination: ManagementDestination; href: string; label: string }[] = [
    { destination: "stores", href: "/settings/stores", label: "Sedes" },
    { destination: "users", href: "/settings/users", label: "Usuarios" },
    { destination: "prices", href: "/settings/prices", label: "Precio de reventa" },
];

/** Account security is a modal; operational settings keep individual routes. */
export function SettingsNavItem() {
    const pathname = usePathname();
    const currentUser = useCurrentUser();
    const { openUserProfile } = useClerk();
    const allowed = new Set(currentUser ? managementDestinationsForRole(currentUser.role) : []);
    const links = SETTINGS_LINKS.filter((item) => allowed.has(item.destination));

    return (
        <Collapsible asChild defaultOpen={pathname.startsWith("/settings")} className="group/collapsible">
            <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                    <SidebarMenuButton tooltip="Configuración" isActive={pathname.startsWith("/settings")}>
                        <Settings2 aria-hidden="true" />
                        <span>Configuración</span>
                        <ChevronRight
                            aria-hidden="true"
                            className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90"
                        />
                    </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <SidebarMenuSub>
                        <SidebarMenuSubItem>
                            <SidebarMenuSubButton asChild>
                                <button
                                    type="button"
                                    onClick={() => openUserProfile({ __experimental_startPath: "/security" })}
                                >
                                    <KeyRound aria-hidden="true" />
                                    <span>Perfil y contraseña</span>
                                </button>
                            </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        {links.map((item) => (
                            <SidebarMenuSubItem key={item.href}>
                                <SidebarMenuSubButton asChild isActive={pathname.startsWith(item.href)}>
                                    <Link href={item.href}>{item.label}</Link>
                                </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                        ))}
                    </SidebarMenuSub>
                </CollapsibleContent>
            </SidebarMenuItem>
        </Collapsible>
    );
}
