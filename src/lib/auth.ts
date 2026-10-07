import { NextRequest } from 'next/server';
import { getAuthenticatedActor } from './auth/actor';
export { hashPassword, verifyPassword } from './auth/password';

export interface TokenPayload {
    id: string;
    userId?: string;
    email: string;
    role: string;
    companyId: string | null;
    storeId: string | null;
}

export async function verifyAuth(req: NextRequest): Promise<TokenPayload | null> {
    try {
        void req;
        const actor = await getAuthenticatedActor();
        if (!actor) return null;
        return {
            id: actor.id,
            userId: actor.id,
            email: actor.email,
            role: actor.role,
            companyId: actor.companyId,
            storeId: actor.storeId,
        };
    } catch (error) {
        console.error('[auth] Unable to resolve authenticated actor', error);
        return null;
    }
}

export function hasPermission(userRole: string, permission: string): boolean {
    // Simple RBAC implementation
    const permissions: Record<string, string[]> = {
        SUPER_ADMIN: ['*'],
        SYSTEM_ADMIN: ['CREATE_COMPANY', 'MANAGE_USERS', 'VIEW_ANALYTICS'],
        OWNER: ['CREATE_STORE', 'MANAGE_STORE_USERS', 'VIEW_COMPANY_ANALYTICS'],
        GENERAL_ADMIN: ['CREATE_STORE', 'MANAGE_STORE_USERS', 'VIEW_COMPANY_ANALYTICS'],
        ADMIN: ['MANAGE_STORE_USERS', 'ACTIVATE_CARDS', 'VIEW_STORE_ANALYTICS'],
        OPERATOR: ['ACTIVATE_CARDS', 'VIEW_STORE_ANALYTICS'],
    };

    const userPermissions = permissions[userRole] || [];
    if (userPermissions.includes('*')) return true;
    return userPermissions.includes(permission);
}
