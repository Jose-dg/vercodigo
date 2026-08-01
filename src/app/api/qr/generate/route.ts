import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { generateUUID } from '@/lib/uuid-generator';
import { generateQRData } from '@/lib/qr-generator';
import { verifyAuth, hasPermission } from '@/lib/auth';

export async function POST(req: NextRequest) {
    try {
        console.log('🔷 [QR] Starting QR generation...');

        // Verificar autenticación
        const user = await verifyAuth(req);
        console.log('👤 [QR] User:', user ? user.email : 'null');

        if (!user) {
            console.log('❌ [QR] No user authenticated');
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        // Verificar permisos
        console.log('🔑 [QR] Checking permissions for role:', user.role);
        if (!hasPermission(user.role, 'CREATE_CARDS')) {
            console.log('❌ [QR] User lacks CREATE_CARDS permission');
            return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
        }

        const body = await req.json();
        console.log('📦 [QR] Request body:', JSON.stringify(body, null, 2));

        const { storeId, productId, denominationId, quantity, customAmount } = body;

        // Validaciones
        if (!storeId || !productId || !quantity) {
            console.log('❌ [QR] Missing required fields:', { storeId, productId, quantity });
            return NextResponse.json(
                { error: 'Datos incompletos' },
                { status: 400 }
            );
        }

        // Verificar que la tienda exista
        console.log('🏪 [QR] Looking for store:', storeId);
        const store = await prisma.store.findUnique({
            where: { id: storeId },
            include: { company: true },
        });

        if (!store) {
            console.log('❌ [QR] Store not found:', storeId);
            return NextResponse.json(
                { error: 'Tienda no encontrada' },
                { status: 404 }
            );
        }
        console.log('✅ [QR] Store found:', store.name);

        // Verificar que el producto exista
        console.log('📦 [QR] Looking for product:', productId);
        const product = await prisma.product.findUnique({
            where: { id: productId },
            include: {
                denominations: { orderBy: { amount: 'asc' } },
            },
        });

        if (!product) {
            console.log('❌ [QR] Product not found:', productId);
            return NextResponse.json(
                { error: 'Producto no encontrado' },
                { status: 404 }
            );
        }
        console.log('✅ [QR] Product found:', product.name);

        // Si no es gift card, resolver denominación (requerida si hay varias)
        let denomination = null;
        if (!product.isGiftCard) {
            if (denominationId) {
                console.log('💰 [QR] Looking for denomination:', denominationId);
                denomination = product.denominations.find((item) => item.id === denominationId) ?? null;
                if (!denomination) {
                    return NextResponse.json(
                        { error: 'Denominación no pertenece al producto' },
                        { status: 400 },
                    );
                }
            } else if (product.denominations.length === 1) {
                denomination = product.denominations[0];
                console.log('💰 [QR] Auto-selected single denomination:', denomination.amount);
            } else if (product.denominations.length > 1) {
                return NextResponse.json(
                    { error: 'Selecciona la denominación del producto' },
                    { status: 400 },
                );
            }
            console.log('💰 [QR] Denomination:', denomination?.amount);
        }

        // Generar tarjetas
        console.log(`🎫 [QR] Generating ${quantity} QR codes...`);
        const cards = [];
        for (let i = 0; i < quantity; i++) {
            const uuid = generateUUID();
            const qrData = generateQRData({
                uuid,
                storeCode: store.code,
                productSku: product.sku,
                amount: denomination?.amount || customAmount,
            });

            console.log(`  📋 [QR] Card ${i + 1}/${quantity} - UUID: ${uuid}`);
            console.log(`  🔗 [QR] QR Data: ${qrData}`);

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

            console.log(`  ✅ [QR] Card created with ID: ${card.id}`);
            cards.push(card);
        }

        console.log(`✅ [QR] Successfully generated ${cards.length} QR codes`);
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
        console.error('❌ [QR] Error generating cards:', error);
        console.error('❌ [QR] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
