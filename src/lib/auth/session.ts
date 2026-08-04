import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import type { TokenPayload } from "@/lib/auth";
import { authOptions } from "@/lib/auth-options";

export async function getSessionUser(): Promise<TokenPayload | null> {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return null;
    return {
        id: session.user.id,
        email: session.user.email ?? "",
        role: session.user.role,
        companyId: session.user.companyId ?? null,
        storeId: session.user.storeId ?? null,
    };
}

export async function requireSessionUser(): Promise<TokenPayload> {
    const user = await getSessionUser();
    if (!user) redirect("/auth/login");
    return user;
}
