import { AbilityBuilder, createMongoAbility, type MongoAbility } from '@casl/ability';
import { UserRole } from '@prisma/client';
import type { AuthenticatedActor } from './actor';

export type Actions = 'manage' | 'create' | 'read' | 'update' | 'delete' | 'activate' | 'approve';
export type Subjects =
    | 'Card'
    | 'CardActivation'
    | 'CodePurchase'
    | 'Invoice'
    | 'Key'
    | 'Company'
    | 'Store'
    | 'User'
    | 'Product'
    | 'AuditLog'
    | 'Wallet'
    | 'WalletTransaction'
    | 'WalletTopUp'
    | 'AccountStatement'
    | 'CompanyProductPrice'
    | 'ProductCost'
    | 'ApiKey'
    | 'all';

export type AppAbility = MongoAbility<[Actions, Subjects]>;

export const PLATFORM_ROLES: UserRole[] = ['SUPER_ADMIN', 'SYSTEM_ADMIN'];

export function isPlatformRole(role: UserRole): boolean {
    return PLATFORM_ROLES.includes(role);
}

/**
 * Bulk card operations run by Diem for a client. Each one is a platform role
 * plus this ability; the API route (`withAuth`), the sidebar and the page all
 * read it from here so a link is never shown to someone the API rejects.
 * Today only SUPER_ADMIN qualifies: SYSTEM_ADMIN cannot activate cards nor
 * `manage all`.
 */
export const CARD_BULK_OPERATIONS = {
    reassign: ['manage', 'all'],
    activate: ['activate', 'Card'],
} as const satisfies Record<string, readonly [Actions, Subjects]>;

export type CardBulkOperation = keyof typeof CARD_BULK_OPERATIONS;

export function canRunCardBulkOperation(
    operation: CardBulkOperation,
    role: UserRole | null | undefined,
    ability: Pick<AppAbility, 'can'>,
): boolean {
    const [action, subject] = CARD_BULK_OPERATIONS[operation];
    return Boolean(role && isPlatformRole(role) && ability.can(action, subject));
}

export function defineAbilitiesFor(user: Pick<AuthenticatedActor, 'role' | 'companyId' | 'storeId'>) {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    if (user.role === 'SUPER_ADMIN') {
        can('manage', 'all');
        // Generación de QR reservada a plataforma (manage all ya lo cubre).
    }

    else if (user.role === 'SYSTEM_ADMIN') {
        can('manage', ['Company', 'Store', 'User', 'Product', 'Key']);
        can('manage', ['Wallet', 'WalletTransaction']); // recargas manuales y tasas FX
        can('manage', 'AccountStatement');
        can('manage', 'CompanyProductPrice');
        can('manage', 'ProductCost'); // costos que la plataforma cobra a las compañías
        can('read', ['Card', 'CardActivation', 'CodePurchase', 'Invoice', 'AuditLog']);
        // Compra de códigos en nombre de una compañía (soporte urgente vía plataforma).
        can('create', 'CodePurchase');
        can('update', 'CodePurchase');
        can(['create', 'update', 'approve'], 'Invoice');
        cannot('delete', 'AuditLog');
        // Solo plataforma genera QR físicos; SYSTEM_ADMIN no activa en mostrador.
        cannot('activate', 'Card');
    }

    // OWNER and GENERAL_ADMIN share the same scope today: the whole company, all stores.
    // They diverge once wallet/financial abilities land (OWNER only) — kept as two
    // branches now so that split doesn't require touching every call site later.
    else if (user.role === 'OWNER' || user.role === 'GENERAL_ADMIN') {
        const companyId = user.companyId || 'NULL';

        // Company
        can('read', 'Company', { id: companyId } as any);
        // Store
        can('manage', 'Store', { companyId } as any);

        // Read data within company scope
        // Note: CASL checks on objects. Ensure loaded objects have these relations or use flat fields where possible.
        // For deep relations, we assume the object passed to ability.can() will have the relation loaded.
        can('read', 'Card', { store: { companyId } } as any);
        can('read', 'CardActivation', { store: { companyId } } as any);
        can('read', 'Invoice', { companyId } as any);
        can('read', 'CodePurchase', { companyId } as any);

        // Users
        can(['read', 'create', 'update'], 'User', { companyId } as any);
        // Cannot delete users, maybe soft delete? For now standard delete restricted

        // Activation
        can('activate', 'Card', { store: { companyId } } as any);

        // Purchase
        can('create', 'CodePurchase'); // Assuming they can purchase for their company
        can('update', 'CodePurchase', { companyId } as any);

        // Wallet: balance + histórico en solo lectura. La recarga self-service
        // (Bre-B, cobrada y verificada por DevDiem) la hacen OWNER y GENERAL_ADMIN.
        can('read', ['Wallet', 'WalletTransaction'], { companyId } as any);
        can(['read', 'create'], 'WalletTopUp', { companyId } as any);
        can('read', 'AccountStatement', { companyId } as any);
        can('read', 'ProductCost', { companyId } as any);

        // Precios de venta: OWNER y GENERAL_ADMIN los configuran para su compañía.
        can(['read', 'create', 'update', 'delete'], 'CompanyProductPrice', { companyId } as any);

        // API keys de la compañía (API v1): crear, listar y revocar. Son credenciales
        // de la compañía: ni la plataforma las ve (ver canManageApiKeys).
        can('manage', 'ApiKey', { companyId } as any);
    }

    else if (user.role === 'ADMIN') {
        const storeId = user.storeId || 'NULL';

        // Store
        can('read', 'Store', { id: storeId } as any);

        // Card
        can('read', 'Card', { storeId } as any);
        can('activate', 'Card', { storeId, isActivated: false } as any);

        // Purchase
        can('read', 'CodePurchase', { storeId } as any);
        can('create', 'CodePurchase'); // purchases assigned to their store
        can('update', 'CodePurchase', { storeId } as any);

        // History
        can('read', 'CardActivation', { storeId } as any);

        // Users: manages the staff of their own store
        can(['read', 'create', 'update'], 'User', { storeId } as any);

        // Precio de venta como referencia al vender (scope de compañía)
        can('read', 'CompanyProductPrice', { companyId: user.companyId || 'NULL' } as any);
        can('read', 'ProductCost', { companyId: user.companyId || 'NULL' } as any);

        cannot('delete', 'Card');
        cannot('update', 'Card', ['fabricationUnitCost', 'batchId']);
    }

    else if (user.role === 'OPERATOR') {
        const storeId = user.storeId || 'NULL';

        // Store
        can('read', 'Store', { id: storeId } as any);

        // Card
        can('read', 'Card', { storeId } as any);
        can('activate', 'Card', { storeId, isActivated: false } as any);

        // Purchase
        can('read', 'CodePurchase', { storeId } as any);
        can('create', 'CodePurchase'); // purchases assigned to their store
        can('update', 'CodePurchase', { storeId } as any);

        // History
        can('read', 'CardActivation', { storeId } as any);

        // Precio de venta como referencia al vender (scope de compañía)
        can('read', 'CompanyProductPrice', { companyId: user.companyId || 'NULL' } as any);
        can('read', 'ProductCost', { companyId: user.companyId || 'NULL' } as any);

        cannot('delete', 'Card');
        cannot('update', 'Card', ['fabricationUnitCost', 'batchId']);
    }

    return build({
        // Helper to detect subject type if passing instances
        detectSubjectType: (item) => (item as any).__typename || (item as any).constructor?.name
    });
}

/**
 * Roles an actor is allowed to assign to another user, based on the client-role
 * hierarchy OWNER > GENERAL_ADMIN > ADMIN > OPERATOR. Single source of truth,
 * used by both the users service (enforcement) and the user form (UI filtering).
 */
export function getAssignableRoles(actorRole: UserRole): UserRole[] {
    switch (actorRole) {
        case 'SUPER_ADMIN':
            return Object.values(UserRole);
        case 'SYSTEM_ADMIN':
            return ['OWNER', 'GENERAL_ADMIN', 'ADMIN', 'OPERATOR'];
        case 'OWNER':
            return ['OWNER', 'GENERAL_ADMIN', 'ADMIN', 'OPERATOR'];
        case 'GENERAL_ADMIN':
            return ['ADMIN', 'OPERATOR'];
        case 'ADMIN':
            return ['OPERATOR'];
        default:
            return [];
    }
}
