import type { ReactNode } from "react";
import { requireManagementAccess } from "@/lib/auth/actor";

export default async function UsersLayout({ children }: { children: ReactNode }) {
    await requireManagementAccess("users");
    return children;
}
