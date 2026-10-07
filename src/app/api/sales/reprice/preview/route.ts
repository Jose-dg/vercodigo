import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/auth/guard";
import { AppError } from "@/lib/errors";
import { previewSaleReprice } from "@/services/pricing/sale-repricing.service";

const Body = z.object({
    targetType: z.enum(["CODE_PURCHASE", "CARD_ACTIVATION"]),
    targetId: z.string().min(1),
    newRate: z.number().positive(),
});

async function handler(req: NextRequest) {
    try {
        const parsed = Body.safeParse(await req.json());
        if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
        return NextResponse.json({ preview: await previewSaleReprice(parsed.data) });
    } catch (error) {
        if (error instanceof AppError) return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
        console.error("[sales/reprice/preview]", error);
        return NextResponse.json({ error: "INTERNAL", message: "Error inesperado" }, { status: 500 });
    }
}

export const POST = withAuth("manage", "ProductCost", handler);
