import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { actorIsPlatform, requireManagementAccess } from "@/lib/auth/actor";

export default async function UsersLayout({ children }: { children: ReactNode }) {
    const actor = await requireManagementAccess("users");
    // Company roles manage this under Configuración; /users stays for the platform.
    if (!actorIsPlatform(actor)) redirect("/settings/users");
    return children;
}
