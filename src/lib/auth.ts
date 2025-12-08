import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { NextRequest } from 'next/server';

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'default-secret-change-me';

export interface TokenPayload {
    userId: string;
    role: string;
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
    const token = req.cookies.get('auth-token')?.value ||
        req.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) return null;
    return verifyToken(token);
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
