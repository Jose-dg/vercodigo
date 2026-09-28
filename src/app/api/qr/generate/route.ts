import type { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { verifyAuth } from "@/lib/auth";
import { isPlatformRole } from "@/lib/auth/abilities";
import prisma from "@/lib/prisma";
import { generateQRData } from "@/lib/qr-generator";
import {
    isValidQrQuantity,
    resolveQrSelection,
    type QrSelectionError,
} from "@/lib/qr/catalog";
import { generateUUID } from "@/lib/uuid-generator";

const ERROR_MESSAGES: Record<QrSelectionError | "QR_QUANTITY_INVALID", string> = {
    QR_PRODUCT_INACTIVE: "El producto no está activo",
    QR_PRODUCT_NOT_ELIGIBLE: "El producto no es elegible para generar QR",
    QR_DENOMINATION_INVALID: "La denominación no pertenece al producto",
    QR_MAPPING_MISSING: "La denominación no tiene mapeo con Diem",
    QR_CUSTOM_AMOUNT_NOT_ALLOWED: "El monto se deriva de la denominación y no puede enviarse manualmente",
    QR_QUANTITY_INVALID: "La cantidad debe ser un entero entre 1 y 100",
};

function errorResponse(code: keyof typeof ERROR_MESSAGES, status = 422) {
    return NextResponse.json({ code, error: ERROR_MESSAGES[code] }, { status });
}

export async function POST(req: NextRequest) {
    try {
        const user = await verifyAuth(req);
        if (!user) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }
        if (!isPlatformRole(user.role as UserRole)) {
            return NextResponse.json(
                { error: "Solo administradores de plataforma pueden generar QR" },
                { status: 403 },
            );
        }

        const body = await req.json();
        const { storeId, productId, denominationId, quantity, customAmount } = body;
        if (typeof storeId !== "string" || typeof productId !== "string") {
            return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
        }
        if (!isValidQrQuantity(quantity)) {
            return errorResponse("QR_QUANTITY_INVALID");
        }

        const [store, product] = await Promise.all([
            prisma.store.findUnique({
                where: { id: storeId },
                include: { company: true },
            }),
            prisma.product.findUnique({
                where: { id: productId },
                include: { denominations: { orderBy: { amount: "asc" } } },
            }),
        ]);

        if (!store) {
            return NextResponse.json({ error: "Tienda no encontrada" }, { status: 404 });
        }
        if (!store.isActive || !store.company.isActive) {
            return NextResponse.json(
                { code: "QR_STORE_INACTIVE", error: "La tienda no está activa" },
                { status: 409 },
            );
        }
        if (!product) {
            return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
        }

        const selection = resolveQrSelection({ product, denominationId, customAmount });
        if (!selection.ok) {
            const conflictCodes: QrSelectionError[] = [
                "QR_PRODUCT_INACTIVE",
                "QR_PRODUCT_NOT_ELIGIBLE",
                "QR_MAPPING_MISSING",
            ];
            return errorResponse(selection.code, conflictCodes.includes(selection.code) ? 409 : 422);
        }

        const cardsToCreate = Array.from({ length: quantity }, () => {
            const uuid = generateUUID();
            return {
                uuid,
                qrData: generateQRData({
                    uuid,
                    storeCode: store.code,
                    productSku: product.sku,
                    amount: selection.denomination.amount,
                }),
                productId: product.id,
                denominationId: selection.denomination.id,
                customAmount: null,
                storeId: store.id,
            };
        });

        const cards = await prisma.$transaction(
            cardsToCreate.map((data) => prisma.card.create({ data })),
        );

        return NextResponse.json({
            success: true,
            message: `${cards.length} tarjetas generadas correctamente`,
            cards: cards.map((card) => ({
                id: card.id,
                uuid: card.uuid,
                qrData: card.qrData,
            })),
        });
    } catch (error) {
        console.error("[QR] Error generating cards", error);
        return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }
}
