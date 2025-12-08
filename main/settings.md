# Guía de Configuración y Deployment

## 📋 Requisitos Previos

- Node.js 18+ y npm/pnpm
- PostgreSQL 14+
- Cuenta en Vercel o Railway
- API Key de empresa matriz
- API de WhatsApp Business configurada (para n8n)

---

## 🚀 Setup Inicial

### 1. Clonar e Instalar

```bash

# Instalar dependencias adicionales
npm install prisma @prisma/client
npm install bcryptjs jsonwebtoken
npm install qrcode nanoid
npm install @radix-ui/react-* class-variance-authority clsx tailwind-merge
npm install lucide-react
npm install zod react-hook-form @hookform/resolvers
npm install date-fns recharts

# Dev dependencies
npm install -D @types/bcryptjs @types/jsonwebtoken
```

### 2. Configurar Variables de Entorno

Crear `.env.local`:

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/pin_distribution"

# NextAuth / JWT
NEXTAUTH_SECRET="tu-secreto-super-seguro-aqui"
NEXTAUTH_URL="http://localhost:3000"

# Empresa Matriz API
MATRIX_API_URL="https://api.empresamatriz.com/v1/pins"
MATRIX_API_KEY="tu-api-key-aqui"

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# n8n Webhook (opcional para desarrollo)
N8N_WEBHOOK_SECRET="secret-para-validar-n8n"
```

### 3. Inicializar Prisma

```bash
# Inicializar Prisma
npx prisma init

# Copiar el schema.prisma del artifact anterior

# Generar cliente
npx prisma generate

# Crear migración inicial
npx prisma migrate dev --name init

# Seed (opcional)
npx prisma db seed
```

---

## 🏗️ Arquitectura de Deployment

### Opción 1: Vercel (Recomendado para MVP)

**Ventajas:**
- Deploy automático desde Git
- Edge functions para APIs
- Fácil configuración de variables de entorno
- CDN global incluido

**Pasos:**

1. Conectar repositorio de GitHub a Vercel
2. Configurar variables de entorno en dashboard
3. Configurar PostgreSQL:
   - Opción A: Vercel Postgres (fácil pero más caro)
   - Opción B: Neon.tech (gratuito hasta 3GB)
   - Opción C: Supabase (gratuito con límites)

```bash
# Build command (Vercel lo detecta automáticamente)
npm run build

# Install command
npm install
```

**Consideraciones:**
- Las funciones serverless tienen timeout de 10s en plan hobby
- Para webhooks de alta frecuencia, considera Edge Runtime

### Opción 2: Railway

**Ventajas:**
- PostgreSQL incluido fácilmente
- Más control sobre el servidor
- Buenos para apps que necesitan procesos de fondo
- Créditos gratis mensuales

**Pasos:**

1. Crear nuevo proyecto en Railway
2. Agregar servicio PostgreSQL
3. Agregar servicio Next.js desde GitHub
4. Railway auto-detecta y configura
5. Variables de entorno se copian automáticamente de PostgreSQL

```bash
# Railway CLI (opcional)
npm install -g @railway/cli
railway login
railway init
railway up
```

---

## 🔒 Seguridad y Mejores Prácticas

### 1. Autenticación JWT

```typescript
// src/lib/auth.ts
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.NEXTAUTH_SECRET!;

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export function generateToken(userId: string, role: string): string {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}
```

### 2. Middleware de Autenticación

```typescript
// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth';

export function middleware(request: NextRequest) {
  // Rutas públicas
  if (
    request.nextUrl.pathname.startsWith('/scan') ||
    request.nextUrl.pathname.startsWith('/api/webhook') ||
    request.nextUrl.pathname.startsWith('/login')
  ) {
    return NextResponse.next();
  }

  // Verificar token para rutas protegidas
  const token = request.cookies.get('auth-token')?.value;
  
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

### 3. Rate Limiting para Webhook

```typescript
// src/lib/rate-limit.ts
const rateLimit = new Map<string, number[]>();

export function checkRateLimit(identifier: string, maxRequests = 10, windowMs = 60000): boolean {
  const now = Date.now();
  const timestamps = rateLimit.get(identifier) || [];
  
  // Filtrar timestamps dentro de la ventana
  const recent = timestamps.filter(t => now - t < windowMs);
  
  if (recent.length >= maxRequests) {
    return false;
  }
  
  recent.push(now);
  rateLimit.set(identifier, recent);
  return true;
}
```

---

## 📊 Monitoreo y Logs

### 1. Logging Estructurado

```typescript
// src/lib/logger.ts
export const logger = {
  info: (message: string, data?: any) => {
    console.log(JSON.stringify({ level: 'info', message, data, timestamp: new Date() }));
  },
  error: (message: string, error?: any) => {
    console.error(JSON.stringify({ level: 'error', message, error: error?.message, timestamp: new Date() }));
  },
  warn: (message: string, data?: any) => {
    console.warn(JSON.stringify({ level: 'warn', message, data, timestamp: new Date() }));
  },
};
```

### 2. Health Check Endpoint

```typescript
// src/app/api/health/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    // Verificar conexión a base de datos
    await prisma.$queryRaw`SELECT 1`;
    
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
    });
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 503 });
  }
}
```

---

## 🔄 CI/CD con GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run Prisma migrations
        run: npx prisma migrate deploy
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          
      - name: Build
        run: npm run build
        
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

---

## 🧪 Testing

```typescript
// tests/api/qr.test.ts
import { createMocks } from 'node-mocks-http';
import { GET } from '@/app/api/qr/[uuid]/route';

describe('/api/qr/[uuid]', () => {
  it('devuelve error si el QR no está activado', async () => {
    const { req, res } = createMocks({
      method: 'GET',
    });

    const response = await GET(req, { params: { uuid: 'TEST1234' } });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('QR no activado');
  });
});
```

---

## 📦 Checklist de Producción

- [ ] Variables de entorno configuradas
- [ ] Base de datos con backups automáticos
- [ ] SSL/TLS habilitado
- [ ] Rate limiting implementado
- [ ] Logs centralizados
- [ ] Monitoreo de uptime (UptimeRobot, Pingdom)
- [ ] Error tracking (Sentry)
- [ ] Backups de base de datos programados
- [ ] Documentación de API
- [ ] Tests básicos implementados
- [ ] Health check endpoint
- [ ] CORS configurado correctamente
- [ ] Validación de webhook con secret

---

## 🎯 Roadmap Post-MVP

1. **Analytics avanzado** con Mixpanel o Amplitude
2. **Sistema de notificaciones** (email/SMS para facturas)
3. **App móvil** para tiendas (React Native)
4. **Panel de reportes** con exports a Excel/PDF
5. **Multi-tenancy** para escalabilidad
6. **Cache con Redis** para mejorar performance
7. **WebSockets** para actualizaciones en tiempo real
8. **API pública** para integraciones de terceros