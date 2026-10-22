import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { actorIsPlatform, requireManagementAccess } from "@/lib/auth/actor";

export default async function StoresLayout({ children }: { children: ReactNode }) {
    const actor = await requireManagementAccess("stores");
    // Company roles manage this under Configuración; /store stays for the platform.
    if (!actorIsPlatform(actor)) redirect("/settings/stores");
    return children;
}
