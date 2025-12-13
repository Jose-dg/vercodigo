import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import crypto from 'crypto';

function verifyWebhookSignature(payload: string, signature: string): boolean {
    const secret = process.env.N8N_WEBHOOK_SECRET;
    if (!secret) return true; // Si no hay secreto configurado, saltar validación (dev mode)

    const hash = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');
    return hash === signature;
}

export async function POST(req: NextRequest) {
    try {
        const bodyText = await req.text();
        const signature = req.headers.get('x-webhook-signature');

        if (process.env.N8N_WEBHOOK_SECRET && (!signature || !verifyWebhookSignature(bodyText, signature))) {
            // Opcional: descomentar para forzar seguridad
            // return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }

        const { uuid, phone, timestamp } = JSON.parse(bodyText);

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
            (ap: { phone: string }) => ap.phone === phone
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
                activationAmount: 0,
                activatedAt: updatedCard.activatedAt ?? new Date(),
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
