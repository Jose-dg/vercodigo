import type { ReactNode } from "react";

import { SettingsTabs, type SettingsTab } from "@/components/settings/settings-tabs";
import { requireAuthenticatedActor } from "@/lib/auth/actor";
import { managementDestinationsForRole, type ManagementDestination } from "@/lib/auth/navigation";

const COMPANY_TABS: { destination: ManagementDestination; tab: SettingsTab }[] = [
    { destination: "stores", tab: { href: "/settings/stores", label: "Sedes" } },
    { destination: "users", tab: { href: "/settings/users", label: "Usuarios" } },
    { destination: "prices", tab: { href: "/settings/prices", label: "Precio de reventa" } },
];

/**
 * Company configuration: profile plus the sections each role used to reach
 * under "Management" (same rule: managementDestinationsForRole).
 */
export default async function SettingsLayout({ children }: { children: ReactNode }) {
    const actor = await requireAuthenticatedActor();
    const allowed = new Set(managementDestinationsForRole(actor.role));
    const tabs: SettingsTab[] = [
        { href: "/settings", label: "Perfil" },
        ...COMPANY_TABS.filter((entry) => allowed.has(entry.destination)).map((entry) => entry.tab),
        { href: "/developers", label: "Desarrolladores" },
    ];

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
            <div className="space-y-4">
                <h1 className="text-3xl font-bold tracking-tight">Configuración</h1>
                <SettingsTabs tabs={tabs} />
            </div>
            {children}
        </div>
    );
}
