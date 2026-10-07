import type { ReactNode } from "react";
import { requireManagementAccess } from "@/lib/auth/actor";

export default async function PricesLayout({ children }: { children: ReactNode }) {
    await requireManagementAccess("prices");
    return children;
}
