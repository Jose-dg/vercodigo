# Sistema de Autorización - CASL + Prisma Middleware (Next.js Edition)
*Control de acceso robusto para gestión de gift cards, adaptado a arquitectura Next.js App Router.*

## Tabla de Contenidos
1. [Introducción](#1-introducción)
2. [Matriz de Permisos](#2-matriz-de-permisos)
3. [Implementación Backend (Next.js)](#3-implementación-backend-nextjs)
4. [Implementación Frontend (React)](#4-implementación-frontend-react)
5. [Testing Strategy](#5-testing-strategy)
6. [Plan de Migración](#6-plan-de-migración)

---

## 1. Introducción

### 1.1 Objetivos
Implementar un sistema de autorización granulado que permita:
1.  **Action-Based Access**: Definir qué puede hacer cada rol (Create, Read, Update, Delete, Activate).
2.  **Scope-Based Access**: Restringir el acceso a datos según la jerarquía (Company -> Store).
3.  **Field-Level Restrictions**: Ocultar campos sensibles (ej. costos) a ciertos roles.

### 1.2 Arquitectura General (Adaptada a Next.js)
A diferencia de NestJS (donde se usan Guards/Interceptors), en Next.js App Router utilizaremos:
*   **CASL**: Para definir las reglas de negocio ("Abilities") de forma isomórfica (backend/frontend).
*   **Prisma Extensions**: Para inyectar filtros de seguridad (Row Level Security lógico) automáticamente en todas las queries.
*   **HOFs (Higher Order Functions) / Middleware**: Para proteger Route Handlers (`GET`, `POST`) y Server Actions.
*   **DTO/Response Helpers**: Para filtrar campos sensibles antes de enviarlos al cliente.

---

## 2. Matriz de Permisos

### Roles
*   `SUPER_ADMIN`: Acceso Total.
*   `SYSTEM_ADMIN`: Gestión global de compañías.
*   `COMPANY_ADMIN`: Gestión de su compañía y tiendas.
*   `STORE_OPERATOR`: Operación limitada a su tienda.

### 2.1 Card Permissions
| Role | Read | Create | Update | Delete | Activate | Scope Filter | Field Restrictions |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- | :--- |
| **SUPER_ADMIN** | ✅ | ✅ | ✅ | ✅ | ✅ | None | None |
| **SYSTEM_ADMIN** | ✅ | ✅ | ✅ | ✅ | ✅ | None | None |
| **COMPANY_ADMIN** | ✅ | ✅ | ✅ | ❌ | ✅ | `companyId` | `fabricationUnitCost` |
| **STORE_OPERATOR** | ✅ | ✅ | ⚠️* | ❌ | ✅** | `storeId` | `fabricationUnitCost`, `batchId` |

\* *Solo campos no críticos (ej. scanCount).*
\** *Solo si `isActivated === false`.*

### 2.2 Invoice Permissions
| Role | Read | Create | Update | Delete | Approve | Scope Filter |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **SUPER_ADMIN** | ✅ | ✅ | ✅ | ✅ | ✅ | None |
| **COMPANY_ADMIN** | ✅ | ❌ | ❌ | ❌ | ❌ | `companyId` |

---

## 3. Implementación Backend (Next.js)

### 3.1 CASL Ability Definitions (`src/lib/auth/abilities.ts`)
Definimos las reglas usando `@casl/ability`.

```typescript
import { AbilityBuilder, createMongoAbility, MongoAbility } from '@casl/ability';
import { User, UserRole } from '@prisma/client';

export type Actions = 'manage' | 'create' | 'read' | 'update' | 'delete' | 'activate';
export type Subjects = 'Card' | 'Store' | 'User' | 'Company' | 'Invoice' | 'all';

export type AppAbility = MongoAbility<[Actions, Subjects]>;

export function defineAbilitiesFor(user: User) {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  if (user.role === 'SUPER_ADMIN') {
    can('manage', 'all');
  } else if (user.role === 'COMPANY_ADMIN') {
    can('read', 'Company', { id: user.companyId });
    can('manage', 'Store', { companyId: user.companyId });
    can('read', 'Card', { store: { companyId: user.companyId } });
  } else if (user.role === 'STORE_OPERATOR') {
    can('read', 'Store', { id: user.storeId });
    can('read', 'Card', { storeId: user.storeId });
    can('activate', 'Card', { storeId: user.storeId, isActivated: false });
    cannot('delete', 'Card');
  }

  return build();
}
```

### 3.2 Prisma Client Extension (`src/lib/prisma.ts`)
En lugar de Middleware (que es deprecado en Prisma moderno), usamos **Extensions** para aplicar filtros automáticos.

```typescript
// src/lib/prisma-enhanced.ts
import { PrismaClient } from '@prisma/client';

export function getEnhancedPrisma(user: User) {
  return new PrismaClient().$extends({
    query: {
      $allModels: {
        async findMany({ model, args, query }) {
          // Aplicar filtros automáticos según rol
          if (user.role === 'STORE_OPERATOR' && model === 'Card') {
             args.where = { ...args.where, storeId: user.storeId };
          }
          return query(args);
        }
      }
    }
  });
}
```

### 3.3 Authorization Guard / Wrapper (`src/lib/auth/guard.ts`)
Un wrapper para proteger Route Handlers.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { defineAbilitiesFor, AppAbility } from './abilities';
import { verifyAuth } from './verify-auth'; // Tu lógica actual

type Handler = (req: NextRequest, ctx: any, ability: AppAbility) => Promise<NextResponse>;

export function withAuth(action: string, subject: string, handler: Handler) {
  return async (req: NextRequest, ctx: any) => {
    const user = await verifyAuth(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const ability = defineAbilitiesFor(user);
    if (ability.cannot(action, subject)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return handler(req, ctx, ability);
  };
}

// Uso en Route Handler:
// export const POST = withAuth('activate', 'Card', async (req, ctx, ability) => { ... });
```

### 3.4 Field Filtering (`src/lib/auth/serialization.ts`)
Función helper para limpiar respuestas.

```typescript
const HIDDEN_FIELDS = {
  STORE_OPERATOR: {
    Card: ['fabricationUnitCost', 'batchId']
  }
};

export function serialize<T>(data: T, user: User, model: string): Partial<T> {
  // Lógica para borrar llaves prohibidas
  return data;
}
```

---

## 4. Implementación Frontend (React)

### 4.1 Hooks (`src/hooks/useAbility.ts`)
Contexto de React para exponer `ability` al frontend.

```typescript
'use client';
import { createContext, useContext } from 'react';
import { createContextualCan } from '@casl/react';
import { AppAbility } from '@/lib/auth/abilities';

export const AbilityContext = createContext<AppAbility>(null!);
export const Can = createContextualCan(AbilityContext.Consumer);

export const useAbility = () => useContext(AbilityContext);
```

### 4.2 Component Example
```tsx
import { Can } from '@/hooks/useAbility';

export function CardActions({ card }) {
  return (
    <div>
      <Can I="activate" a="Card" this={card}>
        <button onClick={...}>Activate</button>
      </Can>
      
      <Can I="delete" a="Card">
         <button className="text-red-500">Delete</button>
      </Can>
    </div>
  )
}
```

---

## 5. Testing Strategy
*   **Unit Tests**: Probar `defineAbilitiesFor` con diferentes usuarios mock.
*   **Integration Tests**: Probar endpoints protegidos con `withAuth` usando mocks de request.

## 6. Plan de Migración
1.  Instalar dependencias: `npm install @casl/ability @casl/react`.
2.  Implementar `abilities.ts` y `guard.ts`.
3.  Migrar endpoints críticos (`/api/cards/activate`) para usar `withAuth`.
4.  Implementar Prisma Extensions gradualmente para reemplazar filtros manuales.
