'use client';

import { createContext, useContext } from 'react';
import { createContextualCan } from '@casl/react';
import { AppAbility } from '@/lib/auth/abilities';
import { UserRole } from '@prisma/client';

export const AbilityContext = createContext<AppAbility>(null!);
export const Can = createContextualCan(AbilityContext.Consumer);

export const useAbility = () => useContext(AbilityContext);

export interface CurrentUser {
    id: string;
    role: UserRole;
    companyId: string | null;
    storeId: string | null;
}

// Raw actor identity, kept alongside the derived AppAbility: some UI (e.g. the
// role picker in the user form) needs to know the actor's own role, not just
// what it's allowed to do, to compute assignable roles via getAssignableRoles.
export const CurrentUserContext = createContext<CurrentUser | null>(null);

export const useCurrentUser = () => useContext(CurrentUserContext);

export function AbilityProvider({
    ability,
    user,
    children
}: {
    ability: AppAbility;
    user: CurrentUser | null;
    children: React.ReactNode
}) {
    return (
        <AbilityContext.Provider value={ability}>
            <CurrentUserContext.Provider value={user}>
                {children}
            </CurrentUserContext.Provider>
        </AbilityContext.Provider>
    );
}
