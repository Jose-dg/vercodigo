import { User, UserRole } from "@prisma/client";

// Define restricted fields per model and role
// If a role is listed, the fields in the array are REMOVED
const RESTRICTED_FIELDS: Record<string, Partial<Record<UserRole, string[]>>> = {
    Card: {
        [UserRole.OPERATOR]: ['fabricationUnitCost', 'batchId'],
        [UserRole.ADMIN]: ['fabricationUnitCost', 'batchId'],
        [UserRole.OWNER]: ['fabricationUnitCost'],
        [UserRole.GENERAL_ADMIN]: ['fabricationUnitCost']
    },
    Company: {
        [UserRole.OPERATOR]: ['commissionRate', 'taxId', 'billingFrequency'],
        [UserRole.ADMIN]: ['commissionRate', 'taxId', 'billingFrequency'],
        [UserRole.OWNER]: [], // Can see everything of their company
        [UserRole.GENERAL_ADMIN]: []
    },
    User: {
        [UserRole.OPERATOR]: ['passwordHash', 'role'], // Can't see roles of others ideally, but definitely not hash
        [UserRole.ADMIN]: ['passwordHash', 'role'],
        [UserRole.OWNER]: ['passwordHash'],
        [UserRole.GENERAL_ADMIN]: ['passwordHash'],
        [UserRole.SYSTEM_ADMIN]: ['passwordHash'],
        [UserRole.SUPER_ADMIN]: ['passwordHash']
    }
};

/**
 * Serializes data by removing restricted fields based on the user's role.
 * @param data The object or array of objects to serialize
 * @param user The user requesting the data
 * @param modelName The Prisma model name (e.g. 'Card', 'User')
 */
export function serialize<T>(data: T, user: User, modelName: string): Partial<T> {
    if (!data) return data;

    // Handle Arrays
    if (Array.isArray(data)) {
        return data.map(item => serialize(item, user, modelName)) as any;
    }

    // Handle Objects
    if (typeof data === 'object' && data !== null) {
        // Get restricted fields for this model and role
        const restrictions = RESTRICTED_FIELDS[modelName]?.[user.role];

        if (!restrictions || restrictions.length === 0) {
            return data;
        }

        // Create a shallow copy to avoid mutating original
        const sanitized = { ...data } as any;

        restrictions.forEach(field => {
            delete sanitized[field];
        });

        return sanitized;
    }

    return data;
}
