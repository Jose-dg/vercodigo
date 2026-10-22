"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export type SettingsTab = { href: string; label: string };

export function SettingsTabs({ tabs }: { tabs: SettingsTab[] }) {
    const pathname = usePathname();
    return (
        <nav aria-label="Secciones de configuración" className="-mb-px flex gap-1 overflow-x-auto border-b">
            {tabs.map((tab) => {
                const active = tab.href === "/settings" ? pathname === "/settings" : pathname.startsWith(tab.href);
                return (
                    <Link
                        key={tab.href}
                        href={tab.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                            "whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                            active
                                ? "border-primary text-foreground"
                                : "border-transparent text-muted-foreground hover:text-foreground",
                        )}
                    >
                        {tab.label}
                    </Link>
                );
            })}
        </nav>
    );
}
