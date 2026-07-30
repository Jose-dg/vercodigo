SISTEMA DE AUTORIZACIÓN
"Necesito diseñar e implementar un sistema robusto de autorización y control de acceso para una aplicación de gestión de gift cards/tarjetas digitales usando CASL + Prisma Middleware + NestJS Guards.

📋 CONTEXTO TÉCNICO
Stack:

Framework: NestJS + TypeScript
ORM: Prisma (PostgreSQL)
Auth: JWT-based authentication
Frontend: React/Next.js (isomorfismo CASL)

Schema Actual:
prisma- User (id, email, role, companyId?, storeId?)
- Company (id, name, stores[], users[])
- Store (id, name, companyId, users[], cards[])
- Card (id, uuid, productId, storeId, isActivated)
- CardActivation (id, cardId, storeId, activatedBy)
- CodePurchase (id, companyId, storeId?, userId, productId)
- Key (id, code, productId, status)
- Invoice (id, companyId, periodStart, status)
- Product (id, name, sku)
- AuditLog (id, action, userId, entityType)
Roles Existentes:
typescriptenum UserRole {
  SUPER_ADMIN      // Acceso total al sistema
  SYSTEM_ADMIN     // Administra todas las compañías
  COMPANY_ADMIN    // Administra su compañía y tiendas
  STORE_OPERATOR   // Opera solo su tienda asignada
}
```

**Jerarquía de Datos:**
```
SUPER_ADMIN → Todo el sistema
SYSTEM_ADMIN → Todas las companies
COMPANY_ADMIN → Su company + todas sus stores
STORE_OPERATOR → Solo su store

🎯 OBJETIVOS DEL SISTEMA
1. Control de Acceso por Acción (Action-Based)
Definir QUÉ puede hacer cada rol con cada recurso:

manage (all actions)
read (ver datos)
create (crear nuevos registros)
update (modificar existentes)
delete (eliminar)
activate (activar cards - acción custom)
approve (aprobar invoices - acción custom)
export (exportar reportes)

2. Control de Acceso por Alcance (Scope-Based)
Filtrar automáticamente datos según:

storeId para STORE_OPERATOR
companyId para COMPANY_ADMIN
Sin filtros para SYSTEM_ADMIN y SUPER_ADMIN

3. Control de Acceso Condicional
Permisos basados en condiciones:

"Puede editar Cards solo si pertenecen a su tienda"
"Puede ver Invoices solo de su compañía"
"Puede delete solo si status === 'DRAFT'"
"Puede activate Card solo si no está activada"

4. Prevención de Privilege Escalation

STORE_OPERATOR no puede modificar su storeId
COMPANY_ADMIN no puede asignarse a otra compañía
No se puede auto-promover roles

5. Auditabilidad Completa

Registrar en AuditLog TODAS las acciones
Capturar before/after states
Registrar intentos fallidos de acceso


🏗️ ARQUITECTURA PROPUESTA
Capa 1: CASL Ability Definitions
Define las reglas de permisos por rol
typescript// abilities/ability.factory.ts
import { AbilityBuilder, createMongoAbility } from '@casl/ability';

export function defineAbilitiesFor(user: User) {
  const { can, cannot, build } = new AbilityBuilder(createMongoAbility);
  
  if (user.role === 'SUPER_ADMIN') {
    can('manage', 'all');
  }
  
  if (user.role === 'SYSTEM_ADMIN') {
    can('manage', ['Company', 'Store', 'Product', 'User']);
    can('read', ['Invoice', 'Card', 'CardActivation']);
    cannot('delete', 'AuditLog');
  }
  
  if (user.role === 'COMPANY_ADMIN') {
    can('read', 'Company', { id: user.companyId });
    can('manage', 'Store', { companyId: user.companyId });
    can('read', 'Invoice', { companyId: user.companyId });
    can('create', 'User', { companyId: user.companyId, role: 'STORE_OPERATOR' });
    cannot('update', 'User', ['role', 'companyId']);
  }
  
  if (user.role === 'STORE_OPERATOR') {
    can('read', 'Card', { storeId: user.storeId });
    can('create', 'CodePurchase', { storeId: user.storeId });
    can('activate', 'Card', { storeId: user.storeId, isActivated: false });
    cannot('delete', 'Card');
    cannot('update', 'Card', ['storeId', 'fabricationUnitCost']);
  }
  
  return build();
}
Capa 2: Prisma Middleware (Auto-Scope Filtering)
Inyecta filtros automáticamente en queries
typescript// prisma/middleware/authorization.middleware.ts
export function createAuthorizationMiddleware(user: User) {
  return async (params, next) => {
    // Solo aplicar a modelos con scope
    const scopedModels = ['Card', 'CardActivation', 'CodePurchase', 'Invoice', 'Store'];
    
    if (!scopedModels.includes(params.model)) {
      return next(params);
    }
    
    // STORE_OPERATOR: filtrar por storeId
    if (user.role === 'STORE_OPERATOR' && user.storeId) {
      params.args.where = {
        ...params.args.where,
        storeId: user.storeId
      };
    }
    
    // COMPANY_ADMIN: filtrar por companyId
    if (user.role === 'COMPANY_ADMIN' && user.companyId) {
      if (params.model === 'Invoice') {
        params.args.where = {
          ...params.args.where,
          companyId: user.companyId
        };
      }
      // Para Store, Card, etc. necesitamos join
      if (['Card', 'CardActivation'].includes(params.model)) {
        params.args.where = {
          ...params.args.where,
          store: { companyId: user.companyId }
        };
      }
    }
    
    return next(params);
  };
}
Capa 3: NestJS Guards
Verifican permisos en endpoints
typescript// guards/abilities.guard.ts
@Injectable()
export class AbilitiesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const ability = defineAbilitiesFor(user);
    
    // Obtener metadata del decorator
    const requiredPermissions = this.reflector.get<Permission[]>(
      'permissions',
      context.getHandler()
    );
    
    return requiredPermissions.every(permission => 
      ability.can(permission.action, permission.subject)
    );
  }
}

// Decorator
export const CheckAbilities = (...permissions: Permission[]) =>
  SetMetadata('permissions', permissions);

// Uso en controller
@Post('cards/:id/activate')
@CheckAbilities({ action: 'activate', subject: 'Card' })
async activateCard(@Param('id') id: string) {
  // ...
}
Capa 4: Field-Level Restrictions
Ocultar campos sensibles por rol
typescript// interceptors/serialize.interceptor.ts
const SENSITIVE_FIELDS = {
  Card: {
    STORE_OPERATOR: ['fabricationUnitCost', 'batchId'],
    COMPANY_ADMIN: ['fabricationUnitCost']
  },
  Company: {
    COMPANY_ADMIN: ['internalNotes'],
    STORE_OPERATOR: ['commissionRate', 'taxId']
  }
};

@Injectable()
export class SerializeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(
      map(data => this.removeFields(data, user.role))
    );
  }
}

📊 ENTREGABLES DETALLADOS
1. DIAGRAMA DE ARQUITECTURA (Mermaid)
mermaidgraph TD
    A[HTTP Request] --> B[Auth Guard]
    B --> C[Abilities Guard]
    C --> D[Controller]
    D --> E[Service]
    E --> F[Prisma with Middleware]
    F --> G[Database]
    E --> H[Audit Log]
    D --> I[Serialize Interceptor]
    I --> J[HTTP Response]
2. MATRIZ DE PERMISOS COMPLETA
Generar tabla exhaustiva por cada modelo:
2.1 Card Permissions
RolereadcreateupdatedeleteactivateScope FilterField RestrictionsSUPER_ADMIN✅✅✅✅✅NoneNoneSYSTEM_ADMIN✅✅✅✅✅NoneNoneCOMPANY_ADMIN✅✅✅❌✅companyIdfabricationUnitCostSTORE_OPERATOR✅✅⚠️*❌✅**storeIdfabricationUnitCost, batchId
*Solo campos: qrData, scanCount
**Solo si isActivated === false y storeId match
2.2 CardActivation Permissions
RolereadcreateupdatedeleteScope FilterConditionsSUPER_ADMIN✅✅✅✅NoneNoneSYSTEM_ADMIN✅❌✅❌NoneNoneCOMPANY_ADMIN✅❌❌❌companyIdNoneSTORE_OPERATOR✅✅❌❌storeIdcreate solo via activate
2.3 CodePurchase Permissions
RolereadcreateupdatedeleteScope FilterConditionsSUPER_ADMIN✅✅✅✅NoneNoneSYSTEM_ADMIN✅✅✅❌NoneNoneCOMPANY_ADMIN✅✅❌❌companyIdNoneSTORE_OPERATOR✅✅❌❌storeIdNone
2.4 Invoice Permissions
RolereadcreateupdatedeleteapproveScope FilterConditionsSUPER_ADMIN✅✅✅✅✅NoneNoneSYSTEM_ADMIN✅✅✅❌✅NoneNoneCOMPANY_ADMIN✅❌❌❌❌companyIdNoneSTORE_OPERATOR✅❌❌❌❌via store.companyIdstatus !== 'DRAFT'
2.5 Key Permissions
RolereadcreateupdatedeleteScope FilterConditionsSUPER_ADMIN✅✅✅✅NoneNoneSYSTEM_ADMIN✅✅✅✅NoneNoneCOMPANY_ADMIN✅❌❌❌NoneNoneSTORE_OPERATOR✅❌❌❌NoneSolo keys asignados
2.6 Company Permissions
RolereadcreateupdatedeleteScope FilterField RestrictionsSUPER_ADMIN✅✅✅✅NoneNoneSYSTEM_ADMIN✅✅✅❌NoneNoneCOMPANY_ADMIN✅❌⚠️*❌own companycommissionRateSTORE_OPERATOR✅❌❌❌via storeAll financial fields
*Solo campos: name, phone, address
2.7 Store Permissions
RolereadcreateupdatedeleteScope FilterField RestrictionsSUPER_ADMIN✅✅✅✅NoneNoneSYSTEM_ADMIN✅✅✅✅NoneNoneCOMPANY_ADMIN✅✅✅❌companyIdNoneSTORE_OPERATOR✅❌⚠️*❌own storecompanyId
*Solo campos: phone
2.8 User Permissions
RolereadcreateupdatedeleteScope FilterField RestrictionsSUPER_ADMIN✅✅✅✅NoneNoneSYSTEM_ADMIN✅✅✅✅NoneNoneCOMPANY_ADMIN✅✅**✅**❌companyIdrole, companyIdSTORE_OPERATOR✅❌⚠️***❌own userAll except name, email
**Solo puede crear STORE_OPERATOR
***Solo puede actualizar su propio perfil
2.9 Product Permissions
RolereadcreateupdatedeleteScope FilterSUPER_ADMIN✅✅✅✅NoneSYSTEM_ADMIN✅✅✅✅NoneCOMPANY_ADMIN✅❌❌❌NoneSTORE_OPERATOR✅❌❌❌None
2.10 AuditLog Permissions
RolereadcreateupdatedeleteScope FilterSUPER_ADMIN✅-❌❌NoneSYSTEM_ADMIN✅-❌❌NoneCOMPANY_ADMIN✅-❌❌companyIdSTORE_OPERATOR❌-❌❌-
3. DEFINICIONES CASL COMPLETAS
Archivo abilities/definitions.ts:
typescriptimport { AbilityBuilder, PureAbility } from '@casl/ability';
import { User, UserRole } from '@prisma/client';

type Actions = 'manage' | 'read' | 'create' | 'update' | 'delete' | 'activate' | 'approve' | 'export';
type Subjects = 
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
  | 'all';

export type AppAbility = PureAbility<[Actions, Subjects]>;

export function defineAbilitiesFor(user: User): AppAbility {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(PureAbility);

  // ===== SUPER_ADMIN =====
  if (user.role === UserRole.SUPER_ADMIN) {
    can('manage', 'all');
    return build();
  }

  // ===== SYSTEM_ADMIN =====
  if (user.role === UserRole.SYSTEM_ADMIN) {
    can('manage', ['Company', 'Store', 'User', 'Product', 'Key']);
    can('read', ['Card', 'CardActivation', 'CodePurchase', 'Invoice', 'AuditLog']);
    can(['create', 'update'], 'Invoice');
    can('approve', 'Invoice');
    can('activate', 'Card');
    cannot('delete', ['Invoice', 'AuditLog']);
  }

  // ===== COMPANY_ADMIN =====
  if (user.role === UserRole.COMPANY_ADMIN && user.companyId) {
    // Company
    can('read', 'Company', { id: user.companyId });
    can('update', 'Company', { id: user.companyId });
    
    // Store
    can('manage', 'Store', { companyId: user.companyId });
    cannot('delete', 'Store'); // Soft delete only
    
    // Card
    can(['read', 'create', 'update'], 'Card', { 
      store: { companyId: user.companyId } 
    });
    can('activate', 'Card', { 
      store: { companyId: user.companyId },
      isActivated: false 
    });
    
    // CardActivation
    can('read', 'CardActivation', { 
      store: { companyId: user.companyId } 
    });
    
    // CodePurchase
    can(['read', 'create'], 'CodePurchase', { companyId: user.companyId });
    
    // Invoice
    can('read', 'Invoice', { companyId: user.companyId });
    
    // Key
    can('read', 'Key');
    
    // User
    can(['read', 'create', 'update'], 'User', { companyId: user.companyId });
    can('create', 'User', { 
      companyId: user.companyId, 
      role: UserRole.STORE_OPERATOR 
    });
    cannot('update', 'User', ['role', 'companyId']);
    
    // Product
    can('read', 'Product');
    
    // AuditLog
    can('read', 'AuditLog', { companyId: user.companyId });
  }

  // ===== STORE_OPERATOR =====
  if (user.role === UserRole.STORE_OPERATOR && user.storeId) {
    // Card
    can('read', 'Card', { storeId: user.storeId });
    can('create', 'Card', { storeId: user.storeId });
    can('update', 'Card', { storeId: user.storeId });
    can('activate', 'Card', { 
      storeId: user.storeId,
      isActivated: false 
    });
    cannot('update', 'Card', ['storeId', 'fabricationUnitCost', 'batchId']);
    cannot('delete', 'Card');
    
    // CardActivation
    can('read', 'CardActivation', { storeId: user.storeId });
    can('create', 'CardActivation', { storeId: user.storeId });
    
    // CodePurchase
    can(['read', 'create'], 'CodePurchase', { storeId: user.storeId });
    
    // Invoice
    can('read', 'Invoice', { 
      company: { stores: { some: { id: user.storeId } } }
    });
    
    // Key
    can('read', 'Key', { 
      card: { storeId: user.storeId } 
    });
    
    // Company (read only - own)
    can('read', 'Company', { 
      stores: { some: { id: user.storeId } } 
    });
    
    // Store (read only - own)
    can('read', 'Store', { id: user.storeId });
    can('update', 'Store', { id: user.storeId });
    cannot('update', 'Store', ['companyId', 'code']);
    
    // User (read own profile)
    can('read', 'User', { id: user.id });
    can('update', 'User', { id: user.id });
    cannot('update', 'User', ['role', 'companyId', 'storeId']);
    
    // Product
    can('read', 'Product');
  }

  return build({
    detectSubjectType: (subject) => subject.constructor.name
  });
}
4. PRISMA MIDDLEWARE COMPLETO
Archivo prisma/middleware/scope-filter.middleware.ts:
typescriptimport { Prisma, UserRole } from '@prisma/client';
import { User } from '@prisma/client';

export function createScopeFilterMiddleware(user: User): Prisma.Middleware {
  return async (params, next) => {
    // Bypass para SUPER_ADMIN y SYSTEM_ADMIN
    if ([UserRole.SUPER_ADMIN, UserRole.SYSTEM_ADMIN].includes(user.role)) {
      return next(params);
    }

    const { model, action } = params;

    // Solo aplicar a operaciones de lectura/escritura
    const applicableActions = ['findMany', 'findUnique', 'findFirst', 'update', 'updateMany', 'delete', 'deleteMany', 'count', 'aggregate'];
    if (!applicableActions.includes(action)) {
      return next(params);
    }

    // ===== COMPANY_ADMIN Filters =====
    if (user.role === UserRole.COMPANY_ADMIN && user.companyId) {
      switch (model) {
        case 'Company':
          params.args.where = {
            ...params.args.where,
            id: user.companyId
          };
          break;

        case 'Store':
          params.args.where = {
            ...params.args.where,
            companyId: user.companyId
          };
          break;

        case 'Card':
        case 'CardActivation':
          params.args.where = {
            ...params.args.where,
            store: {
              companyId: user.companyId
            }
          };
          // Ensure store relation is included
          if (action.startsWith('find')) {
            params.args.include = {
              ...params.args.include,
              store: true
            };
          }
          break;

        case 'CodePurchase':
          params.args.where = {
            ...params.args.where,
            companyId: user.companyId
          };
          break;

        case 'Invoice':
          params.args.where = {
            ...params.args.where,
            companyId: user.companyId
          };
          break;

        case 'User':
          params.args.where = {
            ...params.args.where,
            companyId: user.companyId
          };
          break;

        case 'AuditLog':
          params.args.where = {
            ...params.args.where,
            companyId: user.companyId
          };
          break;
      }
    }

    // ===== STORE_OPERATOR Filters =====
    if (user.role === UserRole.STORE_OPERATOR && user.storeId) {
      switch (model) {
        case 'Store':
          params.args.where = {
            ...params.args.where,
            id: user.storeId
          };
          break;

        case 'Card':
        case 'CardActivation':
          params.args.where = {
            ...params.args.where,
            storeId: user.storeId
          };
          break;

        case 'CodePurchase':
          params.args.where = {
            ...params.args.where,
            storeId: user.storeId
          };
          break;

        case 'Key':
          params.args.where = {
            ...params.args.where,
            card: {
              storeId: user.storeId
            }
          };
          if (action.startsWith('find')) {
            params.args.include = {
              ...params.args.include,
              card: true
            };
          }
          break;

        case 'Company':
          params.args.where = {
            ...params.args.where,
            stores: {
              some: { id: user.storeId }
            }
          };
          break;

        case 'Invoice':
          params.args.where = {
            ...params.args.where,
            company: {
              stores: {
                some: { id: user.storeId }
              }
            }
          };
          if (action.startsWith('find')) {
            params.args.include = {
              ...params.args.include,
              company: { include: { stores: true } }
            };
          }
          break;

        case 'User':
          // Solo su propio perfil
          params.args.where = {
            ...params.args.where,
            id: user.id
          };
          break;
      }
    }

    return next(params);
  };
}

// Setup en main.ts o prisma.service.ts
export class PrismaService extends PrismaClient {
  constructor() {
    super();
  }

  enableAuthMiddleware(user: User) {
    this.$use(createScopeFilterMiddleware(user));
  }
}
5. NESTJS GUARDS Y DECORATORS
Archivo guards/abilities.guard.ts:
typescriptimport { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { defineAbilitiesFor, AppAbility } from '../abilities/definitions';
import { ABILITIES_KEY, RequiredAbility } from '../decorators/abilities.decorator';

@Injectable()
export class AbilitiesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredAbilities = this.reflector.getAllAndOverride<RequiredAbility[]>(
      ABILITIES_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (!requiredAbilities) {
      return true; // No restrictions
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const ability = defineAbilitiesFor(user);

    const hasAbility = requiredAbilities.every(requirement => {
      const { action, subject, conditions } = requirement;
      
      if (conditions) {
        return ability.can(action, subject, conditions);
      }
      
      return ability.can(action, subject);
    });

    if (!hasAbility) {
      throw new ForbiddenException(
        `User does not have required permissions`
      );
    }

    // Attach ability to request for later use
    request.ability = ability;

    return true;
  }
}
Archivo decorators/abilities.decorator.ts:
typescriptimport { SetMetadata } from '@nestjs/common';

export interface RequiredAbility {
  action: string;
  subject: string;
  conditions?: any;
}

export const ABILITIES_KEY = 'abilities';

export const CheckAbilities = (...abilities: RequiredAbility[]) =>
  SetMetadata(ABILITIES_KEY, abilities);

// Helpers
export const CanRead = (subject: string, conditions?: any) =>
  CheckAbilities({ action: 'read', subject, conditions });

export const CanCreate = (subject: string, conditions?: any) =>
  CheckAbilities({ action: 'create', subject, conditions });

export const CanUpdate = (subject: string, conditions?: any) =>
  CheckAbilities({ action: 'update', subject, conditions });

export const CanDelete = (subject: string, conditions?: any) =>
  CheckAbilities({ action: 'delete', subject, conditions });

export const CanActivate = (subject: string, conditions?: any) =>
  CheckAbilities({ action: 'activate', subject, conditions });

export const CanApprove = (subject: string, conditions?: any) =>
  CheckAbilities({ action: 'approve', subject, conditions });
6. EJEMPLO DE USO EN CONTROLLERS
typescriptimport { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AbilitiesGuard } from '../guards/abilities.guard';
import { CanRead, CanCreate, CanUpdate, CanActivate } from '../decorators/abilities.decorator';
import { CardsService } from './cards.service';

@Controller('cards')
@UseGuards(JwtAuthGuard, AbilitiesGuard)
export class CardsController {
  constructor(private cardsService: CardsService) {}

  @Get()
  @CanRead('Card')
  async findAll(@Req() req) {
    // Prisma middleware automáticamente filtra por scope
    return this.cardsService.findAll(req.user);
  }

  @Get(':id')
  @CanRead('Card')
  async findOne(@Param('id') id: string, @Req() req) {
    const card = await this.cardsService.findOne(id, req.user);
    
    // Verificación adicional con CASL
    if (!req.ability.can('read', card)) {
      throw new ForbiddenException('Cannot access this card');
    }
    
    return card;
  }

  @Post()
  @CanCreate('Card')
  async create(@Body() createCardDto: CreateCardDto, @Req() req) {
    // Validar que storeId coincida con el del usuario
    if (req.user.role === 'STORE_OPERATOR' && createCardDto.storeId !== req.user.storeId) {
      throw new ForbiddenException('Cannot create card for different store');
    }
    
    return this.cardsService.create(createCardDto, req.user);
  }

  @Put(':id')
  @CanUpdate('Card')
  async update(@Param('id') id: string, @Body() updateCardDto: UpdateCardDto, @Req() req) {
    const card = await this.cardsService.findOne(id, req.user);
    
    // Verificar con CASL conditions
    if (!req.ability.can('update', card)) {
      throw new ForbiddenException('Cannot update this card');
    }
    
    // Validar campos prohibidos
    const forbiddenFields = ['storeId', 'fabricationUnitCost', 'batchId'];
    if (req.user.role === 'STORE_OPERATOR') {
      const updatingForbiddenFields = forbiddenFields.some(field => field in updateCardDto);
      if (updatingForbiddenFields) {
        throw new ForbiddenException('Cannot update restricted fields');
      }
    }
    
    return this.cardsService.update(id, updateCardDto, req.user);
  }

  @Post(':id/activate')
  @CanActivate('Card')
  async activate(@Param('id') id: string, @Body() activationDto: ActivationDto, @Req() req) {
    const card = await this.cardsService.findOne(id, req.user);
    
    // Verificar condiciones específicas
    if (!req.ability.can('activate', card)) {
      throw new ForbiddenException('Cannot activate this card');
    }
    
    if (card.isActivated) {
      throw new BadRequestException('Card is already activated');
    }
    
    return this.cardsService.activate(id, activationDto, req.user);
  }

  @Delete(':id')
  @CanDelete('Card')
  async remove(@Param('id') id: string, @Req() req) {
    const card = await this.cardsService.findOne(id, req.user);
    
    if (!req.ability.can('delete', card)) {
      throw new ForbiddenException('Cannot delete this card');
    }
    
    return this.cardsService.remove(id, req.user);
  }
}
7. FIELD-LEVEL SERIALIZATION
Archivo interceptors/field-filter.interceptor.ts:
typescriptimport { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { UserRole } from '@prisma/client';

// Definir campos restringidos por rol y modelo
const RESTRICTED_FIELDS = {
  Card: {
    [UserRole.STORE_OPERATOR]: ['fabricationUnitCost', 'batchId'],
    [UserRole.COMPANY_ADMIN]: ['fabricationUnitCost']
  },
  Company: {
    [UserRole.STORE_OPERATOR]: ['commissionRate', 'taxId', 'billingFrequency'],
    [UserRole.COMPANY_ADMIN]: []
  },
  Invoice: {
    [UserRole.STORE_OPERATOR]: ['commissionRate', 'commissionAmount'],
    [UserRole.COMPANY_ADMIN]: []
  },
  User: {
    [UserRole.STORE_OPERATOR]: ['passwordHash'],
    [UserRole.COMPANY_ADMIN]: ['passwordHash'],
    [UserRole.SYSTEM_ADMIN]: ['passwordHash']
  }
};

@Injectable()
export class FieldFilterInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    return next.handle().pipe(
      map(data => this.filterFields(data, user.role))
    );
  }

  private filterFields(data: any, role: UserRole): any {
    if (!data) return data;

    // Si es array, filtrar cada elemento
    if (Array.isArray(data)) {
      return data.map(item => this.filterFields(item, role));
    }

    // Si no es objeto, retornar tal cual
    if (typeof data !== 'object') {
      return data;
    }

    // Detectar tipo de modelo (puede venir en metadata o inferir)
    const modelType = this.detectModelType(data);
    
    if (!modelType || !RESTRICTED_FIELDS[modelType]) {
      return data;
    }

    const restrictedFields = RESTRICTED_FIELDS[modelType][role] || [];
    
    // Crear copia sin campos restringidos
    const filtered = { ...data };
    
    restrictedFields.forEach(field => {
      delete filtered[field];
    });

    // Recursivamente filtrar nested objects
    Object.keys(filtered).forEach(key => {
      if (filtered[key] && typeof filtered[key] === 'object') {
        filtered[key] = this.filterFields(filtered[key], role);
      }
    });

    return filtered;
  }

  private detectModelType(data: any): string | null {
    // Método 1: Si viene en metadata
    if (data.__modelType) return data.__modelType;

    // Método 2: Inferir por campos únicos
    if ('uuid' in data && 'qrData' in data) return 'Card';
    if ('taxId' in data && 'commissionRate' in data) return 'Company';
    if ('invoiceNumber' in data) return 'Invoice';
    if ('passwordHash' in data && 'email' in data) return 'User';

    return null;
  }
}
8. AUDIT LOGGING SERVICE
Archivo services/audit.service.ts:
typescriptimport { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '@prisma/client';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(params: {
    action: string;
    userId: string;
    companyId?: string;
    storeId?: string;
    entityType?: string;
    entityId?: string;
    before?: any;
    after?: any;
    details?: any;
    success: boolean;
    errorMessage?: string;
    ipAddress?: string;
    userAgent?: string;
    deviceId?: string;
  }) {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: params.action,
          userId: params.userId,
          companyId: params.companyId,
          storeId: params.storeId,
          entityType: params.entityType,
          entityId: params.entityId,
          before: params.before,
          after: params.after,
          details: params.details,
          success: params.success,
          errorMessage: params.errorMessage,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
          deviceId: params.deviceId
        }
      });
    } catch (error) {
      // Never fail request due to audit log error
      console.error('Audit log failed:', error);
    }
  }

  async logChange(
    action: string,
    entityType: string,
    entityId: string,
    before: any,
    after: any,
    user: User,
    request: any
  ) {
    await this.log({
      action,
      userId: user.id,
      companyId: user.companyId,
      storeId: user.storeId,
      entityType,
      entityId,
      before,
      after,
      success: true,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent']
    });
  }

  async logForbidden(
    action: string,
    entityType: string,
    user: User,
    request: any,
    reason: string
  ) {
    await this.log({
      action,
      userId: user.id,
      companyId: user.companyId,
      storeId: user.storeId,
      entityType,
      success: false,
      errorMessage: reason,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent']
    });
  }
}
Archivo interceptors/audit.interceptor.ts:
typescriptimport { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { AuditService } from '../services/audit.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const { method, url, body, params } = request;
    
    const action = `${method} ${url}`;
    const entityType = this.extractEntityType(url);
    const entityId = params?.id;

    return next.handle().pipe(
      tap(async (response) => {
        // Log successful action
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
          await this.auditService.log({
            action,
            userId: user.id,
            companyId: user.companyId,
            storeId: user.storeId,
            entityType,
            entityId,
            after: response,
            success: true,
            ipAddress: request.ip,
            userAgent: request.headers['user-agent']
          });
        }
      }),
      catchError(async (error) => {
        // Log failed action
        await this.auditService.log({
          action,
          userId: user?.id,
          companyId: user?.companyId,
          storeId: user?.storeId,
          entityType,
          entityId,
          success: false,
          errorMessage: error.message,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent']
        });
        
        return throwError(() => error);
      })
    );
  }

  private extractEntityType(url: string): string {
    const match = url.match(/\/api\/([^/]+)/);
    return match ? match[1] : 'unknown';
  }
}
9. PREVENCIÓN DE PRIVILEGE ESCALATION
Archivo dto/update-user.dto.ts:
typescriptimport { IsEmail, IsString, IsOptional, IsEnum } from 'class-validator';
import { UserRole } from '@prisma/client';
import { Exclude, Expose } from 'class-transformer';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  // Campos protegidos - solo ciertos roles pueden modificar
  @Exclude()
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @Exclude()
  @IsOptional()
  @IsString()
  companyId?: string;

  @Exclude()
  @IsOptional()
  @IsString()
  storeId?: string;

  @Exclude()
  @IsOptional()
  @IsString()
  passwordHash?: string;
}

// DTO específico para ADMIN que SÍ puede cambiar role
@Expose()
export class AdminUpdateUserDto extends UpdateUserDto {
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsString()
  companyId?: string;

  @IsOptional()
  @IsString()
  storeId?: string;
}
Archivo services/users.service.ts:
typescript@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService
  ) {}

  async update(id: string, updateDto: UpdateUserDto, currentUser: User) {
    const targetUser = await this.prisma.user.findUnique({ where: { id } });
    
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    // Prevenir auto-promoción
    if (id === currentUser.id && 'role' in updateDto) {
      throw new ForbiddenException('Cannot change your own role');
    }

    // Prevenir cambio de companyId para usuarios no-admin
    if ('companyId' in updateDto && ![UserRole.SUPER_ADMIN, UserRole.SYSTEM_ADMIN].includes(currentUser.role)) {
      throw new ForbiddenException('Cannot change company assignment');
    }

    // COMPANY_ADMIN solo puede crear STORE_OPERATOR
    if (currentUser.role === UserRole.COMPANY_ADMIN && 'role' in updateDto) {
      if (updateDto.role !== UserRole.STORE_OPERATOR) {
        throw new ForbiddenException('Can only create STORE_OPERATOR users');
      }
    }

    // Validar que COMPANY_ADMIN solo modifique usuarios de su compañía
    if (currentUser.role === UserRole.COMPANY_ADMIN && targetUser.companyId !== currentUser.companyId) {
      throw new ForbiddenException('Cannot modify users from different company');
    }

    // Log before state
    const before = { ...targetUser };

    const updated = await this.prisma.user.update({
      where: { id },
      data: updateDto
    });

    // Audit log
    await this.auditService.logChange(
      'UPDATE_USER',
      'User',
      id,
      before,
      updated,
      currentUser,
      {} // request object
    );

    return updated;
  }
}
10. TESTING STRATEGY
Archivo abilities/abilities.spec.ts:
typescriptimport { defineAbilitiesFor } from './definitions';
import { User, UserRole } from '@prisma/client';

describe('CASL Abilities', () => {
  describe('SUPER_ADMIN', () => {
    it('should have full access', () => {
      const user: User = {
        id: '1',
        role: UserRole.SUPER_ADMIN,
        companyId: null,
        storeId: null
      } as User;

      const ability = defineAbilitiesFor(user);

      expect(ability.can('manage', 'all')).toBe(true);
      expect(ability.can('delete', 'AuditLog')).toBe(true);
    });
  });

  describe('SYSTEM_ADMIN', () => {
    it('should manage companies and stores', () => {
      const user: User = {
        id: '2',
        role: UserRole.SYSTEM_ADMIN,
        companyId: null,
        storeId: null
      } as User;

      const ability = defineAbilitiesFor(user);

      expect(ability.can('manage', 'Company')).toBe(true);
      expect(ability.can('manage', 'Store')).toBe(true);
      expect(ability.can('read', 'Invoice')).toBe(true);
      expect(ability.can('delete', 'Invoice')).toBe(false);
      expect(ability.can('delete', 'AuditLog')).toBe(false);
    });
  });

  describe('COMPANY_ADMIN', () => {
    it('should only access own company data', () => {
      const user: User = {
        id: '3',
        role: UserRole.COMPANY_ADMIN,
        companyId: 'company1',
        storeId: null
      } as User;

      const ability = defineAbilitiesFor(user);

      expect(ability.can('read', 'Company', { id: 'company1' })).toBe(true);
      expect(ability.can('read', 'Company', { id: 'company2' })).toBe(false);
      expect(ability.can('manage', 'Store', { companyId: 'company1' })).toBe(true);
      expect(ability.can('manage', 'Store', { companyId: 'company2' })).toBe(false);
    });

    it('should not delete stores', () => {
      const user: User = {
        id: '3',
        role: UserRole.COMPANY_ADMIN,
        companyId: 'company1',
        storeId: null
      } as User;

      const ability = defineAbilitiesFor(user);

      expect(ability.can('delete', 'Store')).toBe(false);
    });

    it('should only create STORE_OPERATOR users', () => {
      const user: User = {
        id: '3',
        role: UserRole.COMPANY_ADMIN,
        companyId: 'company1',
        storeId: null
      } as User;

      const ability = defineAbilitiesFor(user);

      expect(ability.can('create', 'User', { 
        companyId: 'company1', 
        role: UserRole.STORE_OPERATOR 
      })).toBe(true);
      
      expect(ability.can('create', 'User', { 
        companyId: 'company1', 
        role: UserRole.COMPANY_ADMIN 
      })).toBe(false);
    });
  });

  describe('STORE_OPERATOR', () => {
    it('should only access own store data', () => {
      const user: User = {
        id: '4',
        role: UserRole.STORE_OPERATOR,
        companyId: 'company1',
        storeId: 'store1'
      } as User;

      const ability = defineAbilitiesFor(user);

      expect(ability.can('read', 'Card', { storeId: 'store1' })).toBe(true);
      expect(ability.can('read', 'Card', { storeId: 'store2' })).toBe(false);
      expect(ability.can('delete', 'Card')).toBe(false);
    });

    it('should only activate non-activated cards from own store', () => {
      const user: User = {
        id: '4',
        role: UserRole.STORE_OPERATOR,
        companyId: 'company1',
        storeId: 'store1'
      } as User;

      const ability = defineAbilitiesFor(user);

      expect(ability.can('activate', 'Card', { 
        storeId: 'store1', 
        isActivated: false 
      })).toBe(true);
      
      expect(ability.can('activate', 'Card', { 
        storeId: 'store1', 
        isActivated: true 
      })).toBe(false);
      
      expect(ability.can('activate', 'Card', { 
        storeId: 'store2', 
        isActivated: false 
      })).toBe(false);
    });

    it('should not update sensitive fields', () => {
      const user: User = {
        id: '4',
        role: UserRole.STORE_OPERATOR,
        companyId: 'company1',
        storeId: 'store1'
      } as User;

      const ability = defineAbilitiesFor(user);

      // Nota: CASL no puede bloquear campos específicos directamente
      // Esto debe validarse en el DTO o service layer
      expect(ability.can('update', 'Card', { storeId: 'store1' })).toBe(true);
    });
  });
});
Archivo guards/abilities.guard.spec.ts:
typescriptimport { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AbilitiesGuard } from './abilities.guard';
import { UserRole } from '@prisma/client';

describe('AbilitiesGuard', () => {
  let guard: AbilitiesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new AbilitiesGuard(reflector);
  });

  it('should allow access when no abilities required', async () => {
    const context = createMockExecutionContext({});
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(null);

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should allow SUPER_ADMIN to access everything', async () => {
    const user = { id: '1', role: UserRole.SUPER_ADMIN };
    const context = createMockExecutionContext({ user });
    
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([
      { action: 'delete', subject: 'AuditLog' }
    ]);

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should deny STORE_OPERATOR from deleting cards', async () => {
    const user = { id: '4', role: UserRole.STORE_OPERATOR, storeId: 'store1' };
    const context = createMockExecutionContext({ user });
    
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([
      { action: 'delete', subject: 'Card' }
    ]);

    await expect(guard.canActivate(context)).rejects.toThrow();
  });
});

function createMockExecutionContext(request: any): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request
    }),
    getHandler: () => ({}),
    getClass: () => ({})
  } as ExecutionContext;
}
11. MÓDULOS Y RUTAS PROTEGIDAS
Archivo app.routes.ts:
typescriptimport { Routes } from '@nestjs/core';
import { UserRole } from '@prisma/client';

export interface RouteConfig {
  path: string;
  allowedRoles: UserRole[];
  requiresAuth: boolean;
}

export const ROUTE_PERMISSIONS: RouteConfig[] = [
  // Public routes
  { path: '/auth/login', allowedRoles: [], requiresAuth: false },
  { path: '/auth/register', allowedRoles: [], requiresAuth: false },
  
  // Dashboard
  { 
    path: '/dashboard', 
    allowedRoles: [UserRole.SUPER_ADMIN, UserRole.SYSTEM_ADMIN, UserRole.COMPANY_ADMIN, UserRole.STORE_OPERATOR],
    requiresAuth: true 
  },
  
  // Cards
  { 
    path: '/cards', 
    allowedRoles: [UserRole.SUPER_ADMIN, UserRole.SYSTEM_ADMIN, UserRole.COMPANY_ADMIN, UserRole.STORE_OPERATOR],
    requiresAuth: true 
  },
  
  // Activations
  { 
    path: '/activations', 
    allowedRoles: [UserRole.SUPER_ADMIN, UserRole.SYSTEM_ADMIN, UserRole.COMPANY_ADMIN, UserRole.STORE_OPERATOR],
    requiresAuth: true 
  },
  
  // Purchases
  { 
    path: '/purchases', 
    allowedRoles: [UserRole.SUPER_ADMIN, UserRole.SYSTEM_ADMIN, UserRole.COMPANY_ADMIN, UserRole.STORE_OPERATOR],
    requiresAuth: true 
  },
  
  // Invoices
  { 
    path: '/invoices', 
    allowedRoles: [UserRole.SUPER_ADMIN, UserRole.SYSTEM_ADMIN, UserRole.COMPANY_ADMIN],
    requiresAuth: true 
  },
  
  // Companies
  { 
    path: '/companies', 
    allowedRoles: [UserRole.SUPER_ADMIN, UserRole.SYSTEM_ADMIN],
    requiresAuth: true 
  },
  
  // Stores
  { 
    path: '/stores', 
    allowedRoles: [UserRole.SUPER_ADMIN, UserRole.SYSTEM_ADMIN, UserRole.COMPANY_ADMIN],
    requiresAuth: true 
  },
  
  // Users
  { 
    path: '/users', 
    allowedRoles: [UserRole.SUPER_ADMIN, UserRole.SYSTEM_ADMIN, UserRole.COMPANY_ADMIN],
    requiresAuth: true 
  },
  
  // Reports
  { 
    path: '/reports', 
    allowedRoles: [UserRole.SUPER_ADMIN, UserRole.SYSTEM_ADMIN, UserRole.COMPANY_ADMIN],
    requiresAuth: true 
  },
  
  // Settings
  { 
    path: '/settings', 
    allowedRoles: [UserRole.SUPER_ADMIN, UserRole.SYSTEM_ADMIN],
    requiresAuth: true 
  },
  
  // Audit Logs
  { 
    path: '/audit', 
    allowedRoles: [UserRole.SUPER_ADMIN],
    requiresAuth: true 
  }
];
Archivo guards/route-access.guard.ts:
typescriptimport { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ROUTE_PERMISSIONS } from '../app.routes';

@Injectable()
export class RouteAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const path = request.route.path;

    const routeConfig = ROUTE_PERMISSIONS.find(r => path.startsWith(r.path));

    if (!routeConfig) {
      return true; // No restriction
    }

    if (routeConfig.requiresAuth && !user) {
      throw new ForbiddenException('Authentication required');
    }

    if (routeConfig.allowedRoles.length === 0) {
      return true; // Public route
    }

    if (!routeConfig.allowedRoles.includes(user.role)) {
      throw new ForbiddenException('Access denied to this route');
    }

    return true;
  }
}
12. FRONTEND INTEGRATION (CASL Isomórfico)
Archivo frontend/abilities/defineAbilities.ts:
typescript// MISMO código que en backend - isomórfico!
import { AbilityBuilder, createMongoAbility } from '@casl/ability';
import { User, UserRole } from '@prisma/client';

export function defineAbilitiesFor(user: User) {
  // ... mismo código que abilities/definitions.ts del backend
}
Archivo frontend/hooks/useAbility.ts:
typescriptimport { createContext, useContext } from 'react';
import { defineAbilitiesFor } from '../abilities/defineAbilities';
import { User } from '@prisma/client';

const AbilityContext = createContext(null);

export const AbilityProvider = ({ user, children }) => {
  const ability = defineAbilitiesFor(user);
  
  return (
    <AbilityContext.Provider value={ability}>
      {children}
    </AbilityContext.Provider>
  );
};

export const useAbility = () => {
  const ability = useContext(AbilityContext);
  if (!ability) {
    throw new Error('useAbility must be used within AbilityProvider');
  }
  return ability;
};

// Helper hook
export const useCan = (action: string, subject: string, conditions?: any) => {
  const ability = useAbility();
  return ability.can(action, subject, conditions);
};
Archivo frontend/components/Can.tsx:
typescriptimport { ReactNode } from 'react';
import { useAbility } from '../hooks/useAbility';

interface CanProps {
  I: string;  // action
  a: string;  // subject
  this?: any; // conditions
  passThrough?: boolean;
  children: ReactNode;
  fallback?: ReactNode;
}

export const Can = ({ I, a, this: conditions, passThrough, children, fallback }: CanProps) => {
  const ability = useAbility();
  const allowed = ability.can(I, a, conditions);

  if (!allowed && passThrough) {
    return <>{children}</>;
  }

  if (!allowed) {
    return <>{fallback || null}</>;
  }

  return <>{children}</>;
};

// Uso:
// <Can I="delete" a="Card">
//   <button>Delete</button>
// </Can>
Archivo frontend/components/CardActions.tsx:
typescriptimport { Can } from './Can';
import { useCan } from '../hooks/useAbility';

export const CardActions = ({ card }) => {
  const canActivate = useCan('activate', 'Card', { 
    storeId: card.storeId, 
    isActivated: false 
  });

  return (
    <div>
      <Can I="read" a="Card">
        <button>View Details</button>
      </Can>

      <Can I="update" a="Card" this={card}>
        <button>Edit</button>
      </Can>

      {canActivate && (
        <button onClick={() => handleActivate(card.id)}>
          Activate
        </button>
      )}

      <Can I="delete" a="Card" fallback={<span>Delete not allowed</span>}>
        <button onClick={() => handleDelete(card.id)}>
          Delete
        </button>
      </Can>
    </div>
  );
};
```

### **13. ESTRUCTURA DE ARCHIVOS**
```
src/
├── abilities/
│   ├── definitions.ts              # CASL ability definitions
│   ├── abilities.spec.ts           # Tests
│   └── index.ts
│
├── guards/
│   ├── abilities.guard.ts          # CASL guard
│   ├── route-access.guard.ts       # Route-level guard
│   ├── abilities.guard.spec.ts     # Tests
│   └── index.ts
│
├── decorators/
│   ├── abilities.decorator.ts      # @CheckAbilities, @CanRead, etc.
│   └── index.ts
│
├── interceptors/
│   ├── field-filter.interceptor.ts # Field-level filtering
│   ├── audit.interceptor.ts        # Audit logging
│   └── index.ts
│
├── services/
│   ├── audit.service.ts            # Audit log service
│   └── index.ts
│
├── prisma/
│   ├── middleware/
│   │   ├── scope-filter.middleware.ts  # Auto scope filtering
│   │   └── index.ts
│   ├── prisma.service.ts
│   └── schema.prisma
│
├── modules/
│   ├── cards/
│   │   ├── cards.controller.ts
│   │   ├── cards.service.ts
│   │   ├── dto/
│   │   └── cards.module.ts
│   ├── activations/
│   ├── purchases/
│   ├── invoices/
│   ├── companies/
│   ├── stores/
│   └── users/
│
├── common/
│   ├── constants/
│   │   └── route-permissions.ts   # Route configs
│   └── types/
│
└── app.module.ts

📚 ENTREGABLES FINALES
Genera un documento Markdown completo (AUTHORIZATION_SYSTEM.md) que contenga:

✅ Introducción y Arquitectura

Diagrama Mermaid de flujo de autorización
Comparación con alternativas (ERPNext, Casbin, etc.)
Justificación de CASL + Prisma Middleware


✅ Matriz de Permisos Completa

Tabla detallada para CADA modelo del schema
Incluir: read, create, update, delete, custom actions
Scope filters por rol
Field restrictions


✅ Código de Implementación

CASL definitions completo
Prisma middleware completo
Guards y decorators
Field-level interceptor
Audit service e interceptor
Ejemplos de uso en controllers


✅ Frontend Integration

Hooks de React
Can component
Ejemplos de uso


✅ Testing Strategy

Unit tests para abilities
Integration tests para guards
E2E tests para flujos completos


✅ Security Considerations

Prevención de privilege escalation
Rate limiting por rol
Audit logging obligatorio
Field sanitization


✅ Migration Plan

Cómo migrar desde sistema actual
Scripts de migración de datos
Rollback strategy


✅ Performance Considerations

Caching de abilities
Optimización de Prisma middleware
Índices recomendados en BD


✅ Best Practices

Naming conventions
Code organization
Error handling
Logging standards


✅ Casos de Uso y Ejemplos

Escenarios reales de la aplicación
Edge cases y soluciones




🎯 RESTRICCIONES

❌ NO ejecutar código
❌ NO crear migraciones
❌ NO modificar schema.prisma
✅ SOLO documentar el plan completo
✅ Incluir ejemplos de código funcional
✅ Priorizar claridad y completitud


📝 FORMATO DE SALIDA
markdown# Sistema de Autorización - CASL + Prisma Middleware
*Control de acceso robusto para gestión de gift cards*

## Tabla de Contenidos
[Auto-generada]

## 1. Introducción
### 1.1 Objetivos
### 1.2 Arquitectura General
### 1.3 Por qué CASL + Prisma

## 2. Matriz de Permisos
### 2.1 Card
### 2.2 CardActivation
[... para cada modelo]

## 3. Implementación Backend
### 3.1 CASL Abilities
### 3.2 Prisma Middleware
### 3.3 NestJS Guards
### 3.4 Field Filtering
### 3.5 Audit Logging

## 4. Implementación Frontend
### 4.1 Setup
### 4.2 Hooks
### 4.3 Components

## 5. Testing
### 5.1 Unit Tests
### 5.2 Integration Tests
### 5.3 E2E Tests

## 6. Security
### 6.1 Privilege Escalation
### 6.2 Injection Prevention
### 6.3 Audit Trail

## 7. Performance
### 7.1 Caching
### 7.2 Database Indices
### 7.3 Query Optimization

## 8. Migration Plan
### 8.1 Preparation
### 8.2 Execution
### 8.3 Validation
### 8.4 Rollback

## 9. Maintenance
### 9.1 Adding New Roles
### 9.2 Adding New Models
### 9.3 Debugging

## Anexos
### A. Glosario
### B. Referencias
### C. FAQ
