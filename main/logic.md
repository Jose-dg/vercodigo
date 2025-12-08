# Consideraciones Técnicas y de Negocio

Descripción del Proyecto
Sistema de distribución digital de PINs multimarca que elimina la necesidad de inventario físico para tiendas minoristas. Las tiendas reciben tarjetas físicas con códigos QR únicos que permanecen inactivos hasta el momento de la venta. Cuando un cliente paga, el cajero activa la tarjeta mediante WhatsApp enviando una foto del UUID impreso. El cliente escanea el QR con su smartphone y visualiza instantáneamente su PIN digital (Netflix, Xbox, tarjetas regalo, etc.). El sistema gestiona múltiples tiendas, facturación automática por comisión, control de inventario, prevención de fraude mediante validación de números autorizados, y dashboards analíticos para administradores y operadores.




---

## 🔐 Seguridad Crítica

### 1. Protección del Webhook de Activación

```typescript
// src/app/api/webhook/activate/route.ts
import crypto from 'crypto';

function verifyWebhookSignature(payload: string, signature: string): boolean {
  const secret = process.env.N8N_WEBHOOK_SECRET!;
  const hash = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return hash === signature;
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('x-webhook-signature');
  
  if (!signature || !verifyWebhookSignature(body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }
  
  // Continuar con la lógica...
}
```

**Importante**: n8n debe enviar el hash HMAC-SHA256 del body en el header `x-webhook-signature`.

### 2. Prevención de Fraude en Escaneos

```typescript
// Detectar patrones sospechosos
async function detectSuspiciousActivity(cardId: string): Promise<boolean> {
  const recentScans = await prisma.scanLog.findMany({
    where: {
      cardId,
      scannedAt: {
        gte: new Date(Date.now() - 5 * 60 * 1000), // últimos 5 minutos
      },
    },
  });

  // Si hay más de 3 escaneos fallidos en 5 minutos
  const failedScans = recentScans.filter(s => !s.wasSuccess).length;
  if (failedScans >= 3) {
    // Alertar al super admin
    await notifyAdmin({
      type: 'FRAUD_ALERT',
      cardId,
      message: 'Múltiples intentos de escaneo fallidos',
    });
    return true;
  }

  return false;
}
```

### 3. Rotación de UUIDs Comprometidos

```typescript
// Si detectas que alguien fotografió muchas tarjetas
async function rotateCompromisedCards(storeId: string) {
  // Marcar tarjetas como comprometidas
  await prisma.card.updateMany({
    where: {
      storeId,
      isActivated: false,
    },
    data: {
      isActive: false, // Agregar este campo al schema
    },
  });

  // Generar nuevas tarjetas con nuevos UUIDs
  // La tienda tendrá que reimprimir
}
```

---

## 📊 Optimizaciones de Performance

### 1. Caching para Dashboards

```typescript
// src/lib/cache.ts
const cache = new Map<string, { data: any; expires: number }>();

export function getCached<T>(key: string): T | null {
  const item = cache.get(key);
  if (!item || Date.now() > item.expires) {
    cache.delete(key);
    return null;
  }
  return item.data as T;
}

export function setCache<T>(key: string, data: T, ttlMs = 60000) {
  cache.set(key, { data, expires: Date.now() + ttlMs });
}

// Uso en analytics
export async function getDashboardStats(storeId: string) {
  const cacheKey = `dashboard:${storeId}`;
  const cached = getCached(cacheKey);
  
  if (cached) return cached;
  
  const stats = await prisma.card.groupBy({
    by: ['isActivated'],
    where: { storeId },
    _count: true,
  });
  
  setCache(cacheKey, stats, 5 * 60 * 1000); // 5 minutos
  return stats;
}
```

### 2. Índices Críticos en PostgreSQL

```sql
-- Índices compuestos para queries comunes
CREATE INDEX idx_cards_store_activated ON cards(store_id, is_activated);
CREATE INDEX idx_cards_store_product ON cards(store_id, product_id);
CREATE INDEX idx_scan_logs_card_date ON scan_logs(card_id, scanned_at DESC);
CREATE INDEX idx_activations_store_date ON card_activations(store_id, activated_at DESC);

-- Full text search para búsqueda de tiendas
CREATE INDEX idx_stores_name_trgm ON stores USING gin(name gin_trgm_ops);
```

### 3. Pagination para Listas Grandes

```typescript
// src/services/card.service.ts
interface PaginationParams {
  page: number;
  limit: number;
  storeId?: string;
  isActivated?: boolean;
}

export async function getCardsPaginated(params: PaginationParams) {
  const { page, limit, storeId, isActivated } = params;
  const skip = (page - 1) * limit;

  const [cards, total] = await Promise.all([
    prisma.card.findMany({
      where: { storeId, isActivated },
      skip,
      take: limit,
      include: { product: true, store: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.card.count({ where: { storeId, isActivated } }),
  ]);

  return {
    data: cards,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}
```

---

## 💰 Consideraciones de Facturación

### 1. Job para Generar Facturas Automáticamente

```typescript
// src/jobs/generate-invoices.ts
export async function generateDailyInvoices() {
  const companies = await prisma.company.findMany({
    where: { 
      isActive: true,
      billingFrequency: 'DAILY',
    },
    include: { stores: true },
  });

  for (const company of companies) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Obtener activaciones del día anterior
    const activations = await prisma.cardActivation.findMany({
      where: {
        storeId: { in: company.stores.map(s => s.id) },
        activatedAt: {
          gte: yesterday,
          lt: today,
        },
      },
      include: {
        card: {
          include: {
            product: true,
            denomination: true,
          },
        },
      },
    });

    if (activations.length === 0) continue;

    // Agrupar por producto y denominación
    const grouped = activations.reduce((acc, act) => {
      const key = `${act.card.productId}-${act.card.denominationId}`;
      if (!acc[key]) {
        acc[key] = {
          product: act.card.product,
          denomination: act.card.denomination,
          count: 0,
          total: 0,
        };
      }
      acc[key].count++;
      acc[key].total += act.card.denomination?.amount || 0;
      return acc;
    }, {} as any);

    // Crear factura
    const totalSales = Object.values(grouped).reduce((sum: number, item: any) => sum + item.total, 0);
    const commissionAmount = totalSales * company.commissionRate;

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: `INV-${company.id.slice(0, 4)}-${Date.now()}`,
        companyId: company.id,
        periodStart: yesterday,
        periodEnd: today,
        totalSales,
        commissionRate: company.commissionRate,
        commissionAmount,
        totalAmount: commissionAmount,
        status: 'PENDING',
      },
    });

    // Crear items
    for (const [key, item] of Object.entries(grouped) as any) {
      await prisma.invoiceItem.create({
        data: {
          invoiceId: invoice.id,
          description: `${item.product.name} $${item.denomination.amount} - ${item.count} unidades`,
          quantity: item.count,
          unitPrice: item.denomination.amount,
          totalPrice: item.total,
        },
      });
    }

    // TODO: Enviar email con PDF de factura
    console.log(`Factura generada para ${company.name}: ${invoice.invoiceNumber}`);
  }
}

// Ejecutar con cron job o Vercel Cron
```

### 2. Vercel Cron Job

```typescript
// src/app/api/cron/invoices/route.ts
import { NextResponse } from 'next/server';
import { generateDailyInvoices } from '@/jobs/generate-invoices';

export async function GET(req: Request) {
  // Verificar que viene de Vercel Cron
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await generateDailyInvoices();
  
  return NextResponse.json({ success: true });
}
```

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/invoices",
      "schedule": "0 2 * * *"
    }
  ]
}
```

---

## 📱 Experiencia de Usuario

### 1. PWA para Clientes Finales

```typescript
// next.config.js
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
});

module.exports = withPWA({
  // tu config
});
```

### 2. QR con Logo Embebido

```typescript
// src/lib/qr-generator.ts
import QRCode from 'qrcode';

export async function generateQRWithLogo(data: string, logoPath: string) {
  const qrCanvas = await QRCode.toCanvas(data, {
    width: 300,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
  });

  // Agregar logo en el centro
  const ctx = qrCanvas.getContext('2d');
  const logo = await loadImage(logoPath);
  
  const logoSize = 60;
  const x = (qrCanvas.width - logoSize) / 2;
  const y = (qrCanvas.height - logoSize) / 2;
  
  ctx.drawImage(logo, x, y, logoSize, logoSize);
  
  return qrCanvas.toDataURL();
}
```

### 3. Feedback Visual en Escaneo

```typescript
// src/components/scan/PinDisplay.tsx
'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, Copy } from 'lucide-react';

export function PinDisplay({ pin }: { pin: string }) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(pin);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col items-center gap-4 p-8">
      <CheckCircle2 className="w-16 h-16 text-green-500" />
      <h2 className="text-2xl font-bold">¡Código Activado!</h2>
      
      <div className="bg-gray-100 p-6 rounded-lg">
        <p className="text-3xl font-mono font-bold tracking-wider">
          {pin}
        </p>
      </div>

      <button
        onClick={copyToClipboard}
        className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg"
      >
        <Copy className="w-4 h-4" />
        {copied ? '¡Copiado!' : 'Copiar código'}
      </button>

      <p className="text-sm text-gray-500 text-center">
        Guarda este código. Solo puedes verlo 5 veces.
      </p>
    </div>
  );
}
```

---

## 🎨 Generación de Tarjetas para Imprimir

```typescript
// src/lib/pdf-generator.ts
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

interface CardData {
  uuid: string;
  qrData: string;
  productName: string;
  amount: number;
  storeName: string;
}

export async function generateCardsPDF(cards: CardData[]) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const cardWidth = 85; // Tamaño tarjeta de crédito
  const cardHeight = 54;
  const margin = 10;

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const col = i % 2;
    const row = Math.floor(i / 2) % 5;

    if (i > 0 && i % 10 === 0) {
      doc.addPage();
    }

    const x = margin + col * (cardWidth + margin);
    const y = margin + row * (cardHeight + margin);

    // Borde de la tarjeta
    doc.rect(x, y, cardWidth, cardHeight);

    // QR Code
    const qrImage = await QRCode.toDataURL(card.qrData, { width: 120 });
    doc.addImage(qrImage, 'PNG', x + 5, y + 5, 30, 30);

    // Información del producto
    doc.setFontSize(10);
    doc.text(card.productName, x + 40, y + 10);
    doc.setFontSize(14);
    doc.text(`$${card.amount}`, x + 40, y + 20);

    // UUID (pequeño, parte de atrás)
    doc.setFontSize(8);
    doc.text(`ID: ${card.uuid}`, x + 5, y + cardHeight - 5);
  }

  return doc.output('blob');
}
```

---

## ✅ Siguiente Paso Recomendado

1. **Inicializar el proyecto con Next.js + Prisma**
2. **Implementar primero el flujo crítico**:
   - Generación de QR
   - Webhook de activación
   - Escaneo y visualización de PIN
3. **Luego los dashboards**:
   - Autenticación
   - Dashboard super admin
   - Dashboard tiendas
4. **Finalmente facturación**:
   - Cron jobs
   - Generación de PDFs
   - Sistema de reportes

¿Te ayudo a crear algún componente específico o tienes dudas sobre la arquitectura?