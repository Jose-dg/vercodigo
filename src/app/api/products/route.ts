import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { checkDiemConnection } from "@/lib/devdiem/fulfillment";

export async function GET(req: NextRequest) {
    try {
        const purchasableOnly = req.nextUrl.searchParams.get("purchasable") === "true";
        if (purchasableOnly) {
            const session = await getServerSession(authOptions);
            if (!session) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }

            // El catálogo de Diem es la fuente de verdad para encendido/apagado.
            // Un mapeo local no basta: la oferta debe estar habilitada para la
            // tienda y la cuenta de servicio que atienden a Diem-SAS.
            const catalog = await checkDiemConnection();
            const enabledIds = catalog.catalogProductIds;
            const products = await prisma.product.findMany({
                where: {
                    isActive: true,
                    OR: [
                        { devDiemProductId: { in: enabledIds } },
                        { denominations: { some: { devDiemProductId: { in: enabledIds } } } },
                    ],
                },
                include: {
                    denominations: {
                        where: {
                            OR: [
                                { devDiemProductId: { in: enabledIds } },
                                { product: { devDiemProductId: { in: enabledIds } } },
                            ],
                        },
                        orderBy: { amount: "asc" },
                    },
                },
                orderBy: { name: "asc" },
            });
            return NextResponse.json(products);
        }

        const products = await prisma.product.findMany({
            include: { denominations: true },
        });
        return NextResponse.json(products);
    } catch (error: unknown) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal Server Error" },
            { status: 500 },
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session || session.user.role !== "SUPER_ADMIN") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { name, sku, brand, category, devDiemProductId, denominations = [] } = body;

        if (!name || !sku || !brand) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const product = await prisma.product.create({
            data: {
                name,
                sku,
                brand,
                category,
                devDiemProductId: devDiemProductId || null,
                denominations: {
                    create: denominations.map((denomination: {
                        amount: number;
                        currency: string;
                        devDiemProductId?: string;
                    }) => ({
                        amount: denomination.amount,
                        currency: denomination.currency,
                        devDiemProductId: denomination.devDiemProductId || null,
                    })),
                },
            },
            include: {
                denominations: true,
            },
        });

        return NextResponse.json(product);
    } catch (error: unknown) {
        console.error("Error creating product:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal Server Error" },
            { status: 500 }
        );
    }
}
