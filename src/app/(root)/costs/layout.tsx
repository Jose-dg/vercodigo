import type { ReactNode } from "react";
import { requireManagementAccess } from "@/lib/auth/actor";

export default async function CostsLayout({ children }: { children: ReactNode }) {
    await requireManagementAccess("rates");
    return children;
}
