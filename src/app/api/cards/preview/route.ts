import { NextRequest, NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { previewCardActivation } from "@/services/self-service/activate-card.service";
import { withAuth } from "@/lib/auth/guard";

async function handler(req: NextRequest, _ctx: unknown, _ability: unknown, user: { id: string }) {
    try {
        const qr = req.nextUrl.searchParams.get("qr")?.trim();
        if (!qr) {
            return NextResponse.json(
                { error: "BAD_REQUEST", message: "El parámetro qr es requerido" },
                { status: 400 },
            );
        }

        const preview = await previewCardActivation({ qr, userId: user.id });
        return NextResponse.json(preview);
    } catch (e: unknown) {
        if (e instanceof AppError) {
            return NextResponse.json(
                { error: e.code, message: e.message, details: e.details },
                { status: e.status },
            );
        }
        console.error("[cards/preview] Error:", e);
        return NextResponse.json(
            { error: "INTERNAL", message: "Error inesperado" },
            { status: 500 },
        );
    }
}

export const GET = withAuth("activate", "Card", handler);
