import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { actorIsPlatform, requireManagementAccess } from "@/lib/auth/actor";

export default async function PricesLayout({ children }: { children: ReactNode }) {
    const actor = await requireManagementAccess("prices");
    // Company roles manage this under Configuración; /prices stays for the platform.
    if (!actorIsPlatform(actor)) redirect("/settings/prices");
    return children;
}
