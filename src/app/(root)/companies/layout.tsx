import type { ReactNode } from "react";
import { requireManagementAccess } from "@/lib/auth/actor";

export default async function CompaniesLayout({ children }: { children: ReactNode }) {
    await requireManagementAccess("companies");
    return children;
}
