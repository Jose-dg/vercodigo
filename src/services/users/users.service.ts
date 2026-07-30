import prisma from "@/lib/prisma";
import { User, UserRole } from "@prisma/client";
import { hashPassword } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { getAssignableRoles } from "@/lib/auth/abilities";
import { CreateUserInput, UpdateUserInput } from "./dto";

const COMPANY_WIDE_ROLES: UserRole[] = [UserRole.OWNER, UserRole.GENERAL_ADMIN];
const STORE_SCOPED_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.OPERATOR];

/**
 * Ensures a role/companyId/storeId combination is internally consistent:
 * company-wide roles must not carry a storeId, store-scoped roles must have one.
 * A mismatch here would silently fall through to the 'NULL' sentinel scope in
 * abilities.ts, granting no access instead of failing loudly.
 */
function assertRoleScopeIsCoherent(role: UserRole, companyId?: string | null, storeId?: string | null) {
    if (COMPANY_WIDE_ROLES.includes(role)) {
        if (!companyId) throw new AppError(`${role} requires a companyId`, 400, "BAD_REQUEST");
        if (storeId) throw new AppError(`${role} must not have a storeId`, 400, "BAD_REQUEST");
    }
    if (STORE_SCOPED_ROLES.includes(role)) {
        if (!companyId || !storeId) throw new AppError(`${role} requires both companyId and storeId`, 400, "BAD_REQUEST");
    }
}

/**
 * Creates a new user with scope validation.
 */
export async function createUser(data: CreateUserInput, actor: User) {
    // 1. Validate role assignment (hierarchy) and scope
    if (!getAssignableRoles(actor.role).includes(data.role)) {
        throw new AppError("Cannot assign this role", 403, "FORBIDDEN");
    }
    assertRoleScopeIsCoherent(data.role, data.companyId, data.storeId);

    if (COMPANY_WIDE_ROLES.includes(actor.role)) {
        if (data.companyId !== actor.companyId) {
            throw new AppError("Cannot create user for another company", 403, "FORBIDDEN");
        }
    } else if (actor.role === UserRole.ADMIN) {
        if (data.companyId !== actor.companyId || data.storeId !== actor.storeId) {
            throw new AppError("Cannot create user outside your store", 403, "FORBIDDEN");
        }
    }

    // 2. Check existence
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
        throw new AppError("Email already exists", 409, "CONFLICT");
    }

    // 3. Create
    const user = await prisma.user.create({
        data: {
            name: data.name,
            email: data.email,
            passwordHash: hashPassword(data.password),
            role: data.role,
            companyId: data.companyId,
            storeId: data.storeId,
            isActive: true,
        },
    });

    const { passwordHash, ...safeUser } = user;
    return safeUser;
}

/**
 * Lists users filtered by actor's scope.
 */
export async function getUsers(actor: User) {
    const where: any = {};

    if (COMPANY_WIDE_ROLES.includes(actor.role)) {
        where.companyId = actor.companyId;
    } else if (STORE_SCOPED_ROLES.includes(actor.role)) {
        // ADMIN manages their store's staff; OPERATOR usually doesn't list users,
        // but if they did, only their store.
        where.storeId = actor.storeId;
    }

    const users = await prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            companyId: true,
            storeId: true,
            isActive: true,
            createdAt: true,
            company: { select: { name: true } },
            store: { select: { name: true } }
        }
    });

    return users;
}

/**
 * Updates a user with scope validation.
 */
export async function updateUser(targetUserId: string, data: UpdateUserInput, actor: User) {
    // 1. Check target existence and scope
    if (!targetUserId) {
        throw new AppError("User id is required", 400, "BAD_REQUEST");
    }
    const target = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) {
        throw new AppError("User not found", 404, "NOT_FOUND");
    }

    if (data.role && !getAssignableRoles(actor.role).includes(data.role)) {
        throw new AppError("Cannot promote user to this role", 403, "FORBIDDEN");
    }
    if (data.role) {
        assertRoleScopeIsCoherent(data.role, data.companyId ?? target.companyId, data.storeId ?? target.storeId);
    }

    if (COMPANY_WIDE_ROLES.includes(actor.role)) {
        if (target.companyId !== actor.companyId) {
            throw new AppError("Cannot update user from another company", 403, "FORBIDDEN");
        }
    } else if (actor.role === UserRole.ADMIN) {
        if (target.companyId !== actor.companyId || target.storeId !== actor.storeId) {
            throw new AppError("Cannot update user outside your store", 403, "FORBIDDEN");
        }
    } else if (actor.role === UserRole.OPERATOR) {
        throw new AppError("Operators cannot update users", 403, "FORBIDDEN");
    }

    // 2. Prepare update data
    const updateData: any = { ...data };
    if (data.password) {
        updateData.passwordHash = hashPassword(data.password);
        delete updateData.password;
    }

    // 3. Update. Si se restablece la contraseña, el cambio y su registro de
    // auditoría se guardan en la misma transacción. El hash nunca se incluye
    // en el audit log.
    const updated = await prisma.$transaction(async (tx) => {
        const savedUser = await tx.user.update({
            where: { id: targetUserId },
            data: updateData,
        });

        if (data.password) {
            await tx.auditLog.create({
                data: {
                    action: "USER_PASSWORD_RESET",
                    userId: actor.id,
                    companyId: target.companyId,
                    storeId: target.storeId,
                    entityType: "User",
                    entityId: target.id,
                    details: {
                        resetByRole: actor.role,
                    },
                },
            });
        }

        return savedUser;
    });

    const { passwordHash, ...safeUser } = updated;
    return safeUser;
}

/**
 * Deletes (or deactivates) a user.
 */
export async function deleteUser(targetUserId: string, actor: User) {
    if (!targetUserId) {
        throw new AppError("User id is required", 400, "BAD_REQUEST");
    }
    const target = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) {
        throw new AppError("User not found", 404, "NOT_FOUND");
    }

    if (COMPANY_WIDE_ROLES.includes(actor.role)) {
        if (target.companyId !== actor.companyId) {
            throw new AppError("Cannot delete user from another company", 403, "FORBIDDEN");
        }
    } else if (actor.role === UserRole.ADMIN) {
        if (target.companyId !== actor.companyId || target.storeId !== actor.storeId) {
            throw new AppError("Cannot delete user outside your store", 403, "FORBIDDEN");
        }
    } else if (actor.role === UserRole.OPERATOR) {
        throw new AppError("Operators cannot delete users", 403, "FORBIDDEN");
    }

    // Prevent self-delete
    if (target.id === actor.id) {
        throw new AppError("Cannot delete yourself", 400, "BAD_REQUEST");
    }

    await prisma.user.delete({ where: { id: targetUserId } });
    return { success: true };
}
