import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/auth/guard";
import { isPlatformRole } from "@/lib/auth/abilities";
import { badRequest, forbidden } from "@/lib/errors";
import prisma from "@/lib/prisma";

const COP_PER_USD = 3600;

const Body = z.object({
    name: z.string().min(1),
    sku: z.string().min(1),
    brand: z.string().min(1).default("Steam"),
    category: z.string().optional().default("Gift Card Digital"),
    amount: z.number().positive(),
    currency: z.enum(["USD", "COP"]),
    devDiemProductId: z.string().uuid(),
    cost: z.number().positive().optional(),
});

async function upsertGlobalCost(params: {
    productId: string;
    denominationId: string;
    cost: number;
}) {
    const existing = await prisma.productCost.findFirst({
        where: {
            companyId: null,
            productId: params.productId,
            denominationId: params.denominationId,
        },
    });
    if (existing) {
        await prisma.productCost.update({
            where: { id: existing.id },
            data: { cost: params.cost, currency: "COP", isActive: true },
        });
        return;
    }
    await prisma.productCost.create({
        data: {
            companyId: null,
            productId: params.productId,
            denominationId: params.denominationId,
            cost: params.cost,
            currency: "COP",
            isActive: true,
        },
    });
}

async function handler(
    req: NextRequest,
    _ctx: unknown,
    _ability: unknown,
    user: { role: string },
) {
    if (!isPlatformRole(user.role as "SUPER_ADMIN" | "SYSTEM_ADMIN")) {
        throw forbidden("Solo plataforma puede crear mirrors SAS");
    }
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
        throw badRequest("Payload inválido", parsed.error.issues);
    }
    const spec = parsed.data;

    const product = await prisma.product.upsert({
        where: { sku: spec.sku },
        update: {
            name: spec.name,
            brand: spec.brand,
            category: spec.category ?? "Gift Card Digital",
            isActive: true,
            isGiftCard: true,
            devDiemProductId: null,
        },
        create: {
            name: spec.name,
            sku: spec.sku,
            brand: spec.brand,
            category: spec.category ?? "Gift Card Digital",
            isActive: true,
            isGiftCard: true,
        },
    });

    const byRemote = await prisma.productDenomination.findFirst({
        where: { devDiemProductId: spec.devDiemProductId },
    });
    let denomination;
    if (byRemote) {
        denomination = await prisma.productDenomination.update({
            where: { id: byRemote.id },
            data: {
                productId: product.id,
                amount: spec.amount,
                currency: spec.currency,
                devDiemProductId: spec.devDiemProductId,
            },
        });
    } else {
        denomination = await prisma.productDenomination.upsert({
            where: {
                productId_amount: {
                    productId: product.id,
                    amount: spec.amount,
                },
            },
            update: {
                currency: spec.currency,
                devDiemProductId: spec.devDiemProductId,
            },
            create: {
                productId: product.id,
                amount: spec.amount,
                currency: spec.currency,
                devDiemProductId: spec.devDiemProductId,
            },
        });
    }

    const cost =
        spec.cost
        ?? (spec.currency === "USD" ? spec.amount * COP_PER_USD : spec.amount);
    await upsertGlobalCost({
        productId: product.id,
        denominationId: denomination.id,
        cost,
    });

    return NextResponse.json({
        productId: product.id,
        denominationId: denomination.id,
        cost,
        sku: product.sku,
        name: product.name,
    });
}

export const POST = withAuth("manage", "Product", handler);
