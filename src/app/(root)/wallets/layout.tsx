import type { ReactNode } from "react";
import { requireManagementAccess } from "@/lib/auth/actor";

export default async function WalletsLayout({ children }: { children: ReactNode }) {
    await requireManagementAccess("wallets");
    return children;
}
