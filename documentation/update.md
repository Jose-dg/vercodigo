Documento técnico — Self-Service QR Activation + Compra Instantánea de Códigos (Next.js + Prisma + PostgreSQL)
0) Contexto: qué vamos a implementar y por qué
Problema actual (manual / WhatsApp)

Cliente vende tarjeta física → toma foto del QR → manda por WhatsApp → espera operador → operador busca y activa → confirma → cliente confirma venta.

Resultado:

5–30 min por activación

errores humanos (transcripción, confusión de tienda/producto)

cuellos de botella (dependencia en operador)

poca trazabilidad automática

riesgo alto (no hay devoluciones)

Solución (Self-Service)

Implementar dos flujos:

Activación self-service de tarjetas QR físicas

Operador de tienda (o rol autorizado) escanea QR desde el sistema → valida → confirma con doble check → activa (Matrix si aplica) → queda auditado y facturable.

Compra instantánea de códigos digitales

Empresa compra “al momento” códigos digitales (sin inventario físico) → se valida saldo/límite → se reservan keys → se debita → se entrega una sola vez → se registra compra, auditoría y logs.

Objetivo: que el usuario pase de “esperar al operador” a “resolver en 10–30 segundos”, con seguridad de grado financiero y trazabilidad completa.

1) Restricciones y realidad del proyecto (producción + estructura existente)
Stack confirmado por tu repo

Next.js (App Router) en src/app

Prisma en carpeta prisma/

Estructura actual:

src/app/(auth), src/app/(root), src/app/api, src/app/actions, src/app/scan

src/lib, src/services, src/types, src/hooks, src/providers

src/middleware.ts

✅ Entonces: NO vamos a reestructurar todo (por estar en producción).
Vamos a extender tu estructura con un “bounded context” dentro de src/services y helpers en src/lib, manteniendo los puntos de entrada en src/app/api y src/app/actions.

2) Diseño de alto nivel (arquitectura pragmática para producción)
Capas (sin cambiar tu árbol)

Routes: src/app/api/* (controladores HTTP)

Actions: src/app/actions/* (si ya usas server actions para UI)

Services (UseCases): src/services/self-service/*
Aquí viven los casos de uso “ActivateCard”, “PurchaseCodes”, “RateLimit”, “Audit”, “FraudSignals”.

Lib compartida: src/lib/*
Prisma client, auth helpers, errors, crypto, request context.

Types: src/types/*
DTOs de entrada/salida, enums, contratos.

Prisma: schema + migraciones

Observabilidad: logs estructurados, audit log, métricas (si aplica)

3) Qué cambia en la base de datos (Prisma / Postgres)

Tu schema ya tiene Card, CardActivation, ScanLog, Key, etc. Para seguridad real en self-service, faltan 5 piezas:

3.1. Concurrencia / bloqueo (evitar doble activación)

Agregar a Card:

activationLock + activationLockBy + activationLockAt

version (optimistic concurrency)

activationAttempts + lastActivationAttempt

Por qué: dos personas pueden escanear el mismo QR casi a la vez. Debes garantizar exactly-once activation.

3.2. Bitácora de intentos (ActivationAttempt)

Registrar cada intento (exitoso o fallido) con IP, deviceId, userAgent.

Por qué: antifraude y soporte (si alguien reclama “yo no fui”).

3.3. Rate limiting persistente (RateLimitLog)

Rate limiting por user/acción con ventanas (minuto/hora/día).
En producción grande: Redis/Upstash, pero DB sirve como baseline y es auditable.

3.4. Auditoría central (AuditLog)

Un log transversal: ACTIVATION, CODE_PURCHASE, etc. con before/after y contexto.

3.5. Compra de códigos digitales (CodePurchase + estados de Key)

Tu Key hoy solo tiene code y productId. Para venta instantánea necesitas:

purchaseType (INVENTORY/INSTANT)

status (AVAILABLE/RESERVED/SOLD/…)

purchasedBy, purchasedAt, purchasePrice

y un modelo CodePurchase para recibos y trazabilidad.

Nota crítica sobre cifrado

Si vas a cifrar los códigos en reposo:

NO uses code String @unique con el valor cifrado (se rompe la unicidad).

Mejor:

codeEnc (cifrado)

codeHash (SHA-256) como @unique

4) Rutas y puntos de entrada (sin tocar tu UI más de lo necesario)
API endpoints sugeridos

POST /api/cards/activate
Activa una tarjeta por uuid/QR payload.

POST /api/codes/purchase
Compra instantánea de códigos.

UI / Pages existentes

Tienes src/app/scan. Ideal:

src/app/scan/page.tsx (o subruta) usa la cámara y pega al endpoint.

Confirm modal doble (requiere escribir “ACTIVAR” / “COMPRAR” para acciones irreversibles).

5) Flujo 1 — Activación Self-Service QR (diseño detallado)
5.1. Validaciones por capas (como lo planteaste) + mejoras

CAPA A — Autenticación y permisos

Usuario activo

Rol permitido

Pertenece a la misma empresa/tienda o es admin global

CAPA B — Integridad y estado

Card existe

Store y Product activos

isActivated=false

activationLock=false (o lock expirado)

scanCount <= maxScans (si aplica)

CAPA C — Concurrencia

Lock atómico con updateMany (condición isActivated=false AND activationLock=false)

O version (optimistic) para asegurar que nadie modificó.

CAPA D — Fraude

rate limiting

patrón de fallos reciente

cambio brusco de IP/device

repetición rápida del mismo cardId

CAPA E — Confirmación humana

modal con doble check y texto “NO HAY DEVOLUCIONES”

requiere escribir “ACTIVAR”

CAPA F — Ejecución transaccional

Transacción DB:

adquirir lock

(opcional) llamada Matrix (ver sección async)

escribir CardActivation

marcar Card isActivated=true, liberar lock

logs de intento + auditoría

5.2. Manejo asíncrono (muy importante)

No todo debería ser síncrono si Matrix puede tardar o fallar intermitente.

Tienes dos modos:

Modo 1 — Síncrono (simple, rápido)

Solo si Matrix responde estable en < 2–3s

Timeout estricto (ej. 2.5s)

Si timeout: fallback a modo async

Modo 2 — Asíncrono (recomendado para carga y resiliencia)

El endpoint:

valida + bloquea

crea un ActivationJob (tabla o cola)

responde 202 Accepted con jobId

Worker (cola) ejecuta:

Matrix call + retries con backoff

finaliza activación y libera lock

deja resultado auditado

Ventajas:

No saturas serverless

Controlas reintentos

Evitas locks eternos

Mejor UX: pantalla “Procesando” con polling

Si hoy no quieres meter BullMQ/Redis, puedes comenzar con tabla ActivationJob + cron/worker (node process) en tu infraestructura. Si estás en Vercel puro, es mejor Upstash + queue.

6) Flujo 2 — Compra Instantánea de Códigos (diseño detallado)
6.1. Riesgos reales

“Double spend” de saldo/límite de crédito

“Oversell” de códigos por concurrencia

Reentrega accidental (refresh / reintento)

Exposición de códigos (logs, errores, inspección)

6.2. Reglas y mejoras esenciales

Reserva atómica de keys:

AVAILABLE → RESERVED con condición (si no, race condition)

Debitar saldo con row-lock (si tienes ledger/balance):

SELECT ... FOR UPDATE o transacción serializable

Registrar compra (CodePurchase) antes de “SOLD”

Entrega “una sola vez”:

deliveredAt en CodePurchase o deliveryNonce

si ya se entregó, no vuelves a enviar códigos (solo recibo)

Cifrado en reposo + no imprimir codes en logs/auditoría

Control de monto máximo por transacción y por día

6.3. Manejo asíncrono recomendado

Compra puede ser síncrona (siempre que sea rápida), pero:

si debes llamar proveedor externo para generar/obtener códigos, hazlo async.

Si los códigos ya están cargados en DB, síncrono es OK.

7) Prevención de N+1 y performance (Prisma + Next)
7.1. Problemas típicos

UI pide lista de tarjetas → por cada tarjeta consulta product/store → N+1

UI pide historial → por cada row consulta user/store → N+1

endpoints hacen includes excesivos → payload grande y lenta la DB

7.2. Reglas “de oro”

En endpoints, usa select mínimo (proyecciones).

Para listas, usa paginación (cursor-based ideal).

Para relaciones necesarias, usa include/select en una sola query.

Evita loops con await prisma... dentro (N+1).

Si necesitas armar “mapas” (ej. productId → product), haz:

una query findMany({ where: { id: { in: [...] }}}) y mapeas en memoria

En UI, si vas a leer varias entidades relacionadas, crea endpoints “composed” para evitar que React dispare múltiples fetch.

7.3. Índices recomendados (los que más te van a doler)

Ya tienes varios @@index, excelente. Sumaría:

Card(activationLock) y Card(isActivated, storeId, productId)

ActivationAttempt(userId, createdAt) para antifraude rápido

RateLimitLog(userId, action, windowStart) ya está en unique/index

Key(productId, status, purchaseType) para reserva rápida

CodePurchase(companyId, createdAt, status) para reportes

8) Seguridad: lo que sí o sí debes agregar
8.1. Input validation + sanitización

Zod en routes

Normalizar QR payload (trim, parse URL/JSON)

Bloquear strings gigantes (payloads maliciosos)

8.2. Auth / permisos

No confíes en storeId del cliente. Deriva del user + DB.

Regla: STORE_OPERATOR solo activa en su storeId.

8.3. Idempotencia

Activación: si ya está activada, retorna 409 (o 200 con “ya activada” según UX).

Compra: usa Idempotency-Key header para reintentos del cliente (muy recomendado).

Guardas idempotencyKey en CodePurchase.

Si llega repetida, devuelves el resultado previo (sin regenerar ni cobrar de nuevo).

8.4. No filtrar códigos

Nunca loguear codes en texto plano

AuditLog.details NO debe almacenar el código (solo counts/ids)

Si mandas por email/descarga, loguea evento CodeAccessLog pero no el contenido

9) Observabilidad / soporte (producción)
9.1. AuditLog como “verdad”

Cualquier acción irreversible:

ACTIVATION

CODE_PURCHASE

(futuro) REFUND_EXCEPTION / MANUAL_OVERRIDE

9.2. Correlation IDs

Genera requestId por request (middleware) y pásalo a logs/auditoría.

Esto te salva horas cuando alguien diga: “se activó sola”.

9.3. Métricas mínimas

tasa de activaciones/hora

tasa de fallos por reason

tiempo promedio Matrix

compras por monto (alertas de outliers)

10) Plan de implementación por fases (sin romper producción)
Fase 0 — Preparación “safe”

Agregar tablas y campos (migraciones)

Feature flags en SystemConfig:

SELF_SERVICE_QR_ENABLED

INSTANT_CODES_ENABLED

Agregar AuditLog y empezar a escribirlo desde ya (aunque sea “pasivo”)

Fase 1 — Core Activation (API + service)

Implementar:

src/services/self-service/activate-card.service.ts

Endpoint src/app/api/cards/activate/route.ts

Rate limit + audit + ActivationAttempt

UI: activar desde un botón (sin cámara aún) usando uuid manual

Fase 2 — QR Scanner UI

src/app/scan/*:

cámara

parse QR

confirm modal (doble)

Rollout por compañía (flag)

Fase 3 — Instant Codes

Migración de Key + CodePurchase

Endpoint + service

UI catálogo + confirm + pantalla “una sola vez”

Idempotency-key

Fase 4 — Async / resiliencia

Si Matrix es lento:

ActivationJob + worker/queue

endpoint 202 + polling

Alertas antifraude + bloqueos temporales

Fase 5 — Hardening final

E2E (Playwright)

Carga (k6)

Revisión de índices reales según EXPLAIN ANALYZE

11) Ajuste a tu estructura: carpetas nuevas (mínimas)

Crear dentro de src/services:

src/services/self-service/
  activate-card.service.ts
  purchase-codes.service.ts
  rate-limit.service.ts
  audit.service.ts
  permissions.service.ts
  fraud.service.ts
  dto.ts


Y en src/lib:

src/lib/prisma.ts
src/lib/errors.ts
src/lib/crypto.ts
src/lib/request-context.ts


Y en src/app/api:

src/app/api/cards/activate/route.ts
src/app/api/codes/purchase/route.ts


Esto respeta tu repo, y mantiene aislado el módulo nuevo.

12) Código base (módulo principal) — listo para producción (adaptado a tu estructura)

Te dejo un “core” compacto y production-ready.
OJO: No incluyo aquí todas las migraciones Prisma para no hacer esto infinito, pero sí te indico exactamente qué agregar (sección 3). Si quieres, me pegas tu schema.prisma y te devuelvo el bloque exacto “diff”.

12.1 src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ??
  new PrismaClient({
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") global.prisma = prisma;

12.2 src/lib/errors.ts
export class AppError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public details?: unknown
  ) {
    super(message);
  }
}

export const badRequest = (m: string, d?: unknown) => new AppError(m, 400, "BAD_REQUEST", d);
export const unauthorized = (m: string, d?: unknown) => new AppError(m, 401, "UNAUTHORIZED", d);
export const forbidden = (m: string, d?: unknown) => new AppError(m, 403, "FORBIDDEN", d);
export const notFound = (m: string, d?: unknown) => new AppError(m, 404, "NOT_FOUND", d);
export const conflict = (m: string, d?: unknown) => new AppError(m, 409, "CONFLICT", d);
export const tooMany = (m: string, d?: unknown) => new AppError(m, 429, "RATE_LIMIT", d);

12.3 src/services/self-service/permissions.service.ts
import { prisma } from "@/lib/prisma";
import { forbidden } from "@/lib/errors";

export async function assertCanActivateCard(params: { userId: string; storeId: string; companyId: string }) {
  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { id: true, isActive: true, role: true, storeId: true, companyId: true },
  });

  if (!user || !user.isActive) throw forbidden("Usuario inactivo o no existe.");

  const sameCompany = user.companyId && user.companyId === params.companyId;
  const sameStore = user.storeId && user.storeId === params.storeId;

  const allowed =
    user.role === "SUPER_ADMIN" ||
    user.role === "SYSTEM_ADMIN" ||
    (user.role === "COMPANY_ADMIN" && sameCompany) ||
    (user.role === "STORE_OPERATOR" && sameStore);

  if (!allowed) throw forbidden("No tienes permisos para operar en esta tienda.");

  return user;
}

12.4 src/services/self-service/rate-limit.service.ts

Versión DB-window. En alta carga, esto se migra a Redis sin cambiar el use-case.

import { prisma } from "@/lib/prisma";
import { tooMany } from "@/lib/errors";

type Action = "ACTIVATION" | "CODE_PURCHASE";

const LIMITS: Record<Action, { perMinute: number; perHour: number; perDay: number }> = {
  ACTIVATION: { perMinute: 10, perHour: 100, perDay: 500 },
  CODE_PURCHASE: { perMinute: 5, perHour: 20, perDay: 100 },
};

const floorMinute = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), 0, 0);
const floorHour = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), 0, 0, 0);
const floorDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);

export async function checkRateLimit(params: { userId: string; storeId?: string | null; action: Action }) {
  const now = new Date();
  const windows = [
    { tag: "MINUTE", start: floorMinute(now), limit: LIMITS[params.action].perMinute },
    { tag: "HOUR", start: floorHour(now), limit: LIMITS[params.action].perHour },
    { tag: "DAY", start: floorDay(now), limit: LIMITS[params.action].perDay },
  ] as const;

  for (const w of windows) {
    const actionKey = `${params.action}_${w.tag}`;

    const row = await prisma.rateLimitLog.upsert({
      where: { userId_action_windowStart: { userId: params.userId, action: actionKey, windowStart: w.start } },
      update: { count: { increment: 1 } },
      create: { userId: params.userId, storeId: params.storeId ?? null, action: actionKey, windowStart: w.start, count: 1 },
      select: { count: true },
    });

    if (row.count > w.limit) throw tooMany(`Límite excedido (${params.action} ${w.tag}). Intenta más tarde.`);
  }
}

12.5 src/services/self-service/audit.service.ts
import { prisma } from "@/lib/prisma";

export async function writeAuditLog(input: {
  action: string;
  userId: string;
  companyId?: string | null;
  storeId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceId?: string | null;
  before?: unknown;
  after?: unknown;
  details?: unknown;
  success?: boolean;
  errorMessage?: string | null;
}) {
  await prisma.auditLog.create({
    data: {
      action: input.action,
      userId: input.userId,
      companyId: input.companyId ?? null,
      storeId: input.storeId ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      deviceId: input.deviceId ?? null,
      before: input.before as any,
      after: input.after as any,
      details: input.details as any,
      success: input.success ?? true,
      errorMessage: input.errorMessage ?? null,
    },
  });
}

12.6 src/services/self-service/activate-card.service.ts (core)
import { prisma } from "@/lib/prisma";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { assertCanActivateCard } from "./permissions.service";
import { checkRateLimit } from "./rate-limit.service";
import { writeAuditLog } from "./audit.service";

function extractUuid(qr: string) {
  const v = qr?.trim();
  if (!v) throw badRequest("QR vacío");
  // Si tu QR es URL/JSON, aquí lo parseas (me lo pasas y lo dejamos perfecto).
  return v;
}

export async function activateCard(params: {
  qr: string;
  userId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceId?: string | null;
}) {
  await checkRateLimit({ userId: params.userId, action: "ACTIVATION" });

  const uuid = extractUuid(params.qr);

  const card = await prisma.card.findUnique({
    where: { uuid },
    select: {
      id: true,
      uuid: true,
      isActivated: true,
      activationLock: true,
      version: true,
      storeId: true,
      productId: true,
      customAmount: true,
      store: { select: { id: true, companyId: true, isActive: true, name: true } },
      product: { select: { id: true, name: true, isActive: true } },
    },
  });
  if (!card) throw notFound("Tarjeta no encontrada.");
  if (!card.store.isActive) throw forbidden("Tienda inactiva.");
  if (!card.product.isActive) throw forbidden("Producto inactivo.");
  if (card.isActivated) throw conflict("Esta tarjeta ya está activada.");

  const user = await assertCanActivateCard({
    userId: params.userId,
    storeId: card.storeId,
    companyId: card.store.companyId,
  });

  const before = { isActivated: card.isActivated, lock: card.activationLock, version: card.version };

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1) Lock atómico: evita doble ejecución
      const locked = await tx.card.updateMany({
        where: { id: card.id, isActivated: false, activationLock: false },
        data: {
          activationLock: true,
          activationLockBy: user.id,
          activationLockAt: new Date(),
          activationAttempts: { increment: 1 },
          lastActivationAttempt: new Date(),
        },
      });

      if (locked.count === 0) throw conflict("La tarjeta está en proceso o ya fue activada por otro usuario.");

      // 2) (Opcional) Llamada Matrix: recomendado async si es lenta
      const matrixResponse = null;

      // 3) Marcar activada + liberar lock
      const updated = await tx.card.update({
        where: { id: card.id },
        data: {
          isActivated: true,
          activatedAt: new Date(),
          version: { increment: 1 },
          activationLock: false,
          activationLockBy: null,
          activationLockAt: null,
        },
        select: { id: true, isActivated: true, activatedAt: true, version: true },
      });

      // 4) CardActivation (facturable)
      const activationAmount = card.customAmount ?? 0; // ajusta según denominación
      const activation = await tx.cardActivation.create({
        data: {
          cardId: card.id,
          storeId: card.storeId,
          activatedBy: user.id,
          activationAmount,
          matrixResponse: matrixResponse as any,
        },
        select: { id: true, activatedAt: true, billingStatus: true },
      });

      // 5) Log intento
      await tx.activationAttempt.create({
        data: {
          cardId: card.id,
          userId: user.id,
          storeId: card.storeId,
          companyId: card.store.companyId,
          success: true,
          ipAddress: params.ipAddress ?? null,
          userAgent: params.userAgent ?? null,
          deviceId: params.deviceId ?? null,
        },
      });

      return { updated, activation };
    });

    await writeAuditLog({
      action: "ACTIVATION",
      userId: user.id,
      companyId: card.store.companyId,
      storeId: card.storeId,
      entityType: "Card",
      entityId: card.id,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
      deviceId: params.deviceId ?? null,
      before,
      after: { isActivated: true, version: result.updated.version },
      details: { cardUuid: card.uuid, product: card.product.name, store: card.store.name },
      success: true,
    });

    return {
      success: true,
      activation: result.activation,
      card: { uuid: card.uuid, product: card.product.name, store: card.store.name },
    };
  } catch (e: any) {
    // best effort: liberar lock si quedó pegado (por error intermedio)
    await prisma.card.updateMany({
      where: { id: card.id, activationLock: true, activationLockBy: user.id },
      data: { activationLock: false, activationLockBy: null, activationLockAt: null },
    });

    await prisma.activationAttempt
      .create({
        data: {
          cardId: card.id,
          userId: user.id,
          storeId: card.storeId,
          companyId: card.store.companyId,
          success: false,
          failureReason: e?.message ?? "UNKNOWN",
          ipAddress: params.ipAddress ?? null,
          userAgent: params.userAgent ?? null,
          deviceId: params.deviceId ?? null,
        },
      })
      .catch(() => {});

    await writeAuditLog({
      action: "ACTIVATION",
      userId: user.id,
      companyId: card.store.companyId,
      storeId: card.storeId,
      entityType: "Card",
      entityId: card.id,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
      deviceId: params.deviceId ?? null,
      before,
      details: { error: e?.message, cardUuid: card.uuid },
      success: false,
      errorMessage: e?.message ?? "UNKNOWN",
    });

    throw e;
  }
}

12.7 Endpoint — src/app/api/cards/activate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AppError, unauthorized } from "@/lib/errors";
import { activateCard } from "@/services/self-service/activate-card.service";

const Body = z.object({
  qr: z.string().min(1),
  deviceId: z.string().optional(),
});

const getIp = (req: NextRequest) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

export async function POST(req: NextRequest) {
  try {
    // Ajusta a tu auth real (session/cookie/JWT).
    const userId = req.headers.get("x-user-id");
    if (!userId) throw unauthorized("No autenticado");

    const body = Body.parse(await req.json());

    const result = await activateCard({
      qr: body.qr,
      userId,
      deviceId: body.deviceId ?? null,
      ipAddress: getIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json(result, { status: 200 });
  } catch (e: any) {
    if (e instanceof AppError) {
      return NextResponse.json({ error: e.code, message: e.message, details: e.details }, { status: e.status });
    }
    if (e?.name === "ZodError") {
      return NextResponse.json({ error: "BAD_REQUEST", message: "Payload inválido", details: e.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "INTERNAL", message: "Error inesperado" }, { status: 500 });
  }
}


La compra de códigos la dejamos igual de integrada en src/services/self-service/purchase-codes.service.ts y /api/codes/purchase. Si ya tienes balance/ledger en services, se enchufa ahí (para evitar double spend).

13) Mejoras que probablemente NO estás considerando (y te ahorran dolores)
A) Locks con TTL (watchdog)

Si un proceso cae con lock en true, esa tarjeta queda “muerta”.

Solución: job cada 1–5 min:

libera locks con activationLockAt < now - 2min (o lo que definas)

registra auditoría “LOCK_RECOVERY”

B) Idempotencia en compras

Reintentos del frontend, mala señal, refresh:

Header Idempotency-Key obligatorio en compra.

Guardar en CodePurchase.

Si llega repetida: devuelves mismo purchaseNumber (sin cobrar ni reasignar).

C) SELECT mínimo + payload mínimo

No devuelvas 20 campos si la UI usa 4.

Esto reduce latencia y costos en serverless.

D) Evitar N+1 desde el inicio

Para listados (cards, activations, purchases):

endpoint “composed” que haga join/select correcto de una vez

E) Seguridad de códigos

No guardar códigos planos

No imprimir en logs

Controlar “view once”

opcional: watermark/trace si exportas TXT/PDF

F) Carga (40k+ codes)

Ya lo mencionaste: 40k unique codes.

índices correctos

operaciones masivas con updateMany

evitar lecturas innecesarias

reservar con query eficiente (productId + status + purchaseType index)

14) Checklist final para pasar a producción sin sustos

 Migraciones Prisma aplicadas (campos + tablas)

 Feature flags por compañía (desactivado por defecto)

 Endpoint activation funcionando con uuid manual

 UI confirm modal doble

 Rate limiting encendido

 AuditLog + ActivationAttempt persistiendo

 Locks con TTL watchdog

 Pruebas:

 doble activación simultánea (debe fallar 1)

 rate-limit (429)

 usuario sin permiso (403)

 producto inactivo (403)

 Observabilidad: requestId/correlationId

 Rollout gradual por compañía/tienda