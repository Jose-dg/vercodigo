import type { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { verifyAuth } from "@/lib/auth";
import { isPlatformRole } from "@/lib/auth/abilities";
import prisma from "@/lib/prisma";
import { toQrCatalogItems } from "@/lib/qr/catalog";

export async function GET(req: NextRequest) {
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

    const products = await prisma.product.findMany({
        where: {
            isActive: true,
            isGiftCard: true,
            denominations: {
                some: {
                    OR: [
                        { devDiemProductId: { not: null } },
                        { product: { devDiemProductId: { not: null } } },
                    ],
                },
            },
        },
        select: {
            id: true,
            name: true,
            sku: true,
            isActive: true,
            isGiftCard: true,
            devDiemProductId: true,
            denominations: {
                select: {
                    id: true,
                    amount: true,
                    currency: true,
                    devDiemProductId: true,
                },
            },
        },
        orderBy: { name: "asc" },
    });

    return NextResponse.json({ items: toQrCatalogItems(products) });
}
