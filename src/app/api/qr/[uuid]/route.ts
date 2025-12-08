import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requestPinFromMatrix } from '@/lib/matrix-api';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ uuid: string }> }
) {
    try {
        const { uuid } = await params;
        const ipAddress = req.headers.get('x-forwarded-for') || (req as any).ip;
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
            denomination: card.denomination?.amount || card.customAmount || 0,
            storeCode: card.store.code,
        });

        if (!matrixResponse.success || !matrixResponse.pin) {
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

    // Solo loguear si tenemos un cardId válido (si no existe la tarjeta, no podemos loguear con FK)
    // Podríamos tener una tabla de logs de intentos fallidos sin FK, pero por ahora solo logueamos si existe
    if (cardId.length > 8) {
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
}
