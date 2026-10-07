import type { ReactNode } from "react";
import { requireManagementAccess } from "@/lib/auth/actor";

export default async function ProductsLayout({ children }: { children: ReactNode }) {
    await requireManagementAccess("products");
    return children;
}
