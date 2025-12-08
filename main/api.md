// ============= src/app/api/qr/[uuid]/route.ts =============
// Endpoint público para escanear QR y obtener PIN

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requestPinFromMatrix } from '@/lib/matrix-api';

export async function GET(
  req: NextRequest,
  { params }: { params: { uuid: string } }
) {
  try {
    const { uuid } = params;
    const ipAddress = req.headers.get('x-forwarded-for') || req.ip;
    const userAgent = req.headers.get('user-agent');

    // Buscar la tarjeta
    const card = await prisma.card.findUnique({
      where: { uuid },
      include: {
        product: true,
        denomination: true,
        store: { include: { company: true } },
      },
    });

    if (!card) {
      await logScan(uuid, false, 'card_not_found', ipAddress, userAgent);
      return NextResponse.json(
        { error: 'Tarjeta no encontrada' },
        { status: 404 }
      );
    }

    // Verificar si está activada
    if (!card.isActivated) {
      await logScan(card.id, false, 'not_activated', ipAddress, userAgent);
      return NextResponse.json(
        { 
          error: 'QR no activado', 
          message: 'Comunícate con la tienda',
          store: {
            name: card.store.name,
            phone: card.store.phone,
          }
        },
        { status: 403 }
      );
    }

    // Verificar límite de escaneos
    if (card.scanCount >= card.maxScans) {
      await logScan(card.id, false, 'max_scans_reached', ipAddress, userAgent);
      return NextResponse.json(
        { error: 'Límite de escaneos alcanzado' },
        { status: 403 }
      );
    }

    // Si ya tiene PIN, devolverlo
    if (card.pin) {
      await incrementScanCount(card.id);
      await logScan(card.id, true, 'success', ipAddress, userAgent);
      
      return NextResponse.json({
        success: true,
        pin: card.pin,
        product: card.product.name,
        amount: card.denomination?.amount || card.customAmount,
        currency: card.denomination?.currency || 'USD',
        scansRemaining: card.maxScans - card.scanCount - 1,
      });
    }

    // Solicitar PIN a la empresa matriz
    const matrixResponse = await requestPinFromMatrix({
      productName: card.product.name,
      sku: card.product.sku,
      denomination: card.denomination?.amount || card.customAmount,
      storeCode: card.store.code,
    });

    if (!matrixResponse.success) {
      await logScan(card.id, false, 'matrix_error', ipAddress, userAgent);
      return NextResponse.json(
        { error: 'Error al obtener el PIN. Intenta de nuevo.' },
        { status: 500 }
      );
    }

    // Guardar PIN en la base de datos
    await prisma.card.update({
      where: { id: card.id },
      data: {
        pin: matrixResponse.pin,
        transactionId: matrixResponse.transactionId,
        isRedeemed: true,
        redeemedAt: new Date(),
        scanCount: 1,
      },
    });

    await logScan(card.id, true, 'success', ipAddress, userAgent);

    return NextResponse.json({
      success: true,
      pin: matrixResponse.pin,
      product: card.product.name,
      amount: card.denomination?.amount || card.customAmount,
      currency: card.denomination?.currency || 'USD',
      scansRemaining: card.maxScans - 1,
    });

  } catch (error) {
    console.error('Error in QR scan:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

async function incrementScanCount(cardId: string) {
  await prisma.card.update({
    where: { id: cardId },
    data: { scanCount: { increment: 1 } },
  });
}

async function logScan(
  cardIdOrUuid: string,
  success: boolean,
  reason: string,
  ip?: string | null,
  userAgent?: string | null
) {
  // Si es UUID, buscar el card ID
  let cardId = cardIdOrUuid;
  if (cardIdOrUuid.length === 8) {
    const card = await prisma.card.findUnique({
      where: { uuid: cardIdOrUuid },
      select: { id: true },
    });
    if (card) cardId = card.id;
  }

  await prisma.scanLog.create({
    data: {
      cardId,
      wasSuccess: success,
      reason,
      ipAddress: ip,
      userAgent,
    },
  });
}


// ============= src/app/api/webhook/activate/route.ts =============
// Webhook para activación desde n8n

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const { uuid, phone, timestamp } = await req.json();

    // Validar datos requeridos
    if (!uuid || !phone) {
      return NextResponse.json(
        { error: 'UUID y teléfono son requeridos' },
        { status: 400 }
      );
    }

    // Buscar la tarjeta
    const card = await prisma.card.findUnique({
      where: { uuid },
      include: {
        store: {
          include: {
            authorizedPhones: {
              where: { isActive: true },
            },
          },
        },
      },
    });

    if (!card) {
      return NextResponse.json(
        { error: 'Tarjeta no encontrada' },
        { status: 404 }
      );
    }

    // Verificar si ya está activada
    if (card.isActivated) {
      return NextResponse.json(
        { error: 'Tarjeta ya activada previamente' },
        { status: 400 }
      );
    }

    // Verificar que el teléfono esté autorizado
    const isAuthorized = card.store.authorizedPhones.some(
      (ap) => ap.phone === phone
    );

    if (!isAuthorized) {
      return NextResponse.json(
        { 
          error: 'Teléfono no autorizado para esta tienda',
          storeId: card.store.id,
          phone,
        },
        { status: 403 }
      );
    }

    // Activar la tarjeta
    const updatedCard = await prisma.card.update({
      where: { id: card.id },
      data: {
        isActivated: true,
        activatedAt: new Date(),
      },
    });

    // Crear registro de activación
    await prisma.cardActivation.create({
      data: {
        cardId: card.id,
        storeId: card.storeId,
        activatedBy: phone,
        matrixResponse: { timestamp },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Tarjeta activada correctamente',
      card: {
        uuid: updatedCard.uuid,
        activated: updatedCard.isActivated,
        activatedAt: updatedCard.activatedAt,
      },
    });

  } catch (error) {
    console.error('Error in activation webhook:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}


// ============= src/app/api/qr/generate/route.ts =============
// Generar tarjetas QR para una tienda

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { generateUUID } from '@/lib/uuid-generator';
import { generateQRData } from '@/lib/qr-generator';
import { verifyAuth, hasPermission } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    // Verificar autenticación
    const user = await verifyAuth(req);
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Verificar permisos
    if (!hasPermission(user.role, 'CREATE_CARDS')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { storeId, productId, denominationId, quantity, customAmount } = 
      await req.json();

    // Validaciones
    if (!storeId || !productId || !quantity) {
      return NextResponse.json(
        { error: 'Datos incompletos' },
        { status: 400 }
      );
    }

    // Verificar que la tienda exista
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      include: { company: true },
    });

    if (!store) {
      return NextResponse.json(
        { error: 'Tienda no encontrada' },
        { status: 404 }
      );
    }

    // Verificar que el producto exista
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Producto no encontrado' },
        { status: 404 }
      );
    }

    // Si no es gift card, verificar denominación
    let denomination = null;
    if (!product.isGiftCard && denominationId) {
      denomination = await prisma.productDenomination.findUnique({
        where: { id: denominationId },
      });
    }

    // Generar tarjetas
    const cards = [];
    for (let i = 0; i < quantity; i++) {
      const uuid = generateUUID();
      const qrData = generateQRData({
        uuid,
        storeCode: store.code,
        productSku: product.sku,
        amount: denomination?.amount || customAmount,
      });

      const card = await prisma.card.create({
        data: {
          uuid,
          qrData,
          productId,
          denominationId: denomination?.id,
          customAmount: product.isGiftCard ? customAmount : null,
          storeId,
        },
      });

      cards.push(card);
    }

    return NextResponse.json({
      success: true,
      message: `${quantity} tarjetas generadas correctamente`,
      cards: cards.map(c => ({
        id: c.id,
        uuid: c.uuid,
        qrData: c.qrData,
      })),
    });

  } catch (error) {
    console.error('Error generating cards:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}


// ============= src/lib/matrix-api.ts =============
// Cliente para la API de la empresa matriz

interface MatrixPinRequest {
  productName: string;
  sku: string;
  denomination: number;
  storeCode: string;
}

interface MatrixPinResponse {
  success: boolean;
  pin?: string;
  transactionId?: string;
  error?: string;
}

export async function requestPinFromMatrix(
  data: MatrixPinRequest
): Promise<MatrixPinResponse> {
  try {
    const response = await fetch(process.env.MATRIX_API_URL!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MATRIX_API_KEY}`,
      },
      body: JSON.stringify({
        product_name: data.productName,
        sku: data.sku,
        denomination: data.denomination,
        store_code: data.storeCode,
      }),
    });

    if (!response.ok) {
      throw new Error(`Matrix API error: ${response.status}`);
    }

    const result = await response.json();

    return {
      success: true,
      pin: result.pin,
      transactionId: result.transaction_id,
    };

  } catch (error) {
    console.error('Error requesting PIN from matrix:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}


// ============= src/lib/uuid-generator.ts =============
// Generador de UUID de 8 caracteres

import { customAlphabet } from 'nanoid';

// Solo letras mayúsculas y números, excluyendo caracteres ambiguos
const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const nanoid = customAlphabet(alphabet, 8);

export function generateUUID(): string {
  return nanoid();
}


// ============= src/lib/qr-generator.ts =============
// Generador de datos QR

interface QRDataInput {
  uuid: string;
  storeCode: string;
  productSku: string;
  amount: number;
}

export function generateQRData(input: QRDataInput): string {
  // Generar URL que apunta al endpoint público
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://tudominio.com';
  return `${baseUrl}/scan/${input.uuid}`;
}