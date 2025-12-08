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
