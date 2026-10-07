import type { ReactNode } from "react";
import { requireManagementAccess } from "@/lib/auth/actor";

export default async function StoresLayout({ children }: { children: ReactNode }) {
    await requireManagementAccess("stores");
    return children;
}
