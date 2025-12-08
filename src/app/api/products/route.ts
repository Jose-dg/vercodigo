import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function GET() {
    try {
        const products = await prisma.product.findMany({
            include: { denominations: true },
        });
        return NextResponse.json(products);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session || (session.user as any).role !== "SUPER_ADMIN") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { name, sku, brand, category, denominations } = body;

        if (!name || !sku || !brand) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const product = await prisma.product.create({
            data: {
                name,
                sku,
                brand,
                category,
                denominations: {
                    create: denominations.map((d: any) => ({
                        amount: d.amount,
                        currency: d.currency,
                    })),
                },
            },
            include: {
                denominations: true,
            },
        });

        return NextResponse.json(product);
    } catch (error: any) {
        console.error("Error creating product:", error);
        return NextResponse.json(
            { error: error.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}
