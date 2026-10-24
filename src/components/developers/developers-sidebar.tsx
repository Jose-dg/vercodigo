'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, Braces } from 'lucide-react';

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
    SidebarRail,
} from '@/components/ui/sidebar';
import { DOCS_NAV } from './nav';

/** Documentation navigation, ported from the shadcn sidebar-03 block. */
export function DevelopersSidebar({
    canManageKeys,
    homeHref,
    ...props
}: React.ComponentProps<typeof Sidebar> & { canManageKeys: boolean; homeHref: string }) {
    const pathname = usePathname();
    const sections = DOCS_NAV
        .map((section) => ({
            ...section,
            items: section.items.filter((item) => !item.requiresKeyAccess || canManageKeys),
        }))
        .filter((section) => section.items.length > 0);

    return (
        <Sidebar {...props}>
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href="/developers">
                                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                                    <Braces className="size-4" />
                                </div>
                                <div className="flex flex-col gap-0.5 leading-none">
                                    <span className="font-medium">Documentación</span>
                                    <span className="text-xs text-muted-foreground">v1</span>
                                </div>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
                <SidebarGroup>
                    <SidebarMenu>
                        {sections.map((section) => (
                            <SidebarMenuItem key={section.title}>
                                <SidebarMenuButton asChild>
                                    <Link href={section.items[0].url} className="font-medium">
                                        {section.title}
                                    </Link>
                                </SidebarMenuButton>
                                <SidebarMenuSub>
                                    {section.items.map((item) => (
                                        <SidebarMenuSubItem key={item.url}>
                                            <SidebarMenuSubButton asChild isActive={pathname === item.url}>
                                                <Link href={item.url}>{item.title}</Link>
                                            </SidebarMenuSubButton>
                                        </SidebarMenuSubItem>
                                    ))}
                                </SidebarMenuSub>
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                </SidebarGroup>
            </SidebarContent>
            <SidebarFooter>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                            <Link href={homeHref}>
                                <ArrowLeft className="size-4" />
                                Volver al portal
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    );
}
