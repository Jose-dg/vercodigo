'use client';

import { AbilityProvider } from './ability-context';
import { defineAbilitiesFor } from '@/lib/auth/abilities';
// We use a simplified User type that matches what we get from the Session/Token
// rather than the full Prisma User model, as safely passed from Server Component
interface SessionUser {
    id: string;
    role: string;
    companyId: string | null;
    storeId: string | null;
}

export function AuthProvider({
    user,
    children
}: {
    user: SessionUser | null | undefined;
    children: React.ReactNode
}) {
    // If no user, we can either provide a "guest" ability or just empty
    // For now, let's assume if no user, ability denies everything.
    // We need to cast session user to Prisma User type expected by defineAbilitiesFor
    // mainly for the 'role' field which is string in session but enum in Prisma.

    const ability = defineAbilitiesFor(user as any || { role: 'GUEST' });

    const currentUser = user
        ? { id: user.id, role: user.role as any, companyId: user.companyId, storeId: user.storeId }
        : null;

    return (
        <AbilityProvider ability={ability} user={currentUser}>
            {children}
        </AbilityProvider>
    );
}
