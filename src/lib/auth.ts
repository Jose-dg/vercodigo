import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth-options';

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'default-secret-change-me';

export interface TokenPayload {
    id: string;
    userId?: string;
    email: string;
    role: string;
    companyId: string | null;
    storeId: string | null;
}

export function hashPassword(password: string): string {
    return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
    return bcrypt.compareSync(password, hash);
}

export function generateToken(userId: string, role: string): string {
    return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): TokenPayload | null {
    try {
        return jwt.verify(token, JWT_SECRET) as TokenPayload;
    } catch {
        return null;
    }
}

export async function verifyAuth(req: NextRequest): Promise<TokenPayload | null> {
    console.log('🔍 [AUTH] verifyAuth called');

    try {
        const session = await getServerSession(authOptions);
        console.log('📋 [AUTH] Session:', session ? 'exists' : 'null');
        console.log('👤 [AUTH] Session user:', session?.user);

        if (!session?.user) {
            console.log('❌ [AUTH] No session or user found');
            return null;
        }

        console.log('✅ [AUTH] User authenticated:', session.user.email);
        return {
            id: session.user.id,
            email: session.user.email!,
            role: session.user.role,
            companyId: session.user.companyId ?? null,
            storeId: session.user.storeId ?? null,
        };
    } catch (error) {
        console.error('❌ [AUTH] Error in verifyAuth:', error);
        return null;
    }
}

export function hasPermission(userRole: string, permission: string): boolean {
    // Simple RBAC implementation
    const permissions: Record<string, string[]> = {
        SUPER_ADMIN: ['*'],
        SYSTEM_ADMIN: ['CREATE_COMPANY', 'MANAGE_USERS', 'VIEW_ANALYTICS'],
        COMPANY_ADMIN: ['CREATE_STORE', 'MANAGE_STORE_USERS', 'VIEW_COMPANY_ANALYTICS', 'CREATE_CARDS'],
        STORE_OPERATOR: ['ACTIVATE_CARDS', 'VIEW_STORE_ANALYTICS'],
    };

    const userPermissions = permissions[userRole] || [];
    if (userPermissions.includes('*')) return true;
    return userPermissions.includes(permission);
}
