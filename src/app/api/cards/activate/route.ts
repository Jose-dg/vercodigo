import { NextRequest, NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { extractRequestContext } from "@/lib/request-context";
import { activateCard } from "@/services/self-service/activate-card.service";
import { ActivateCardBody } from "@/services/self-service/dto";
import { withAuth } from "@/lib/auth/guard";

// Wrapped Handler
async function handler(req: NextRequest, ctx: any, ability: any, user: any) {
    try {
        // 2) Contexto de request (IP, UA, deviceId, requestId)
        const reqCtx = extractRequestContext(req);

        // 3) Validar body con Zod
        const raw = await req.json();
        const parseResult = ActivateCardBody.safeParse(raw);

        if (!parseResult.success) {
            return NextResponse.json(
                {
                    error: "BAD_REQUEST",
                    message: "Payload inválido",
                    details: parseResult.error.issues,
                },
                { status: 400 }
            );
        }

        const body = parseResult.data;

        // 4) Ejecutar activación
        const result = await activateCard({
            qr: body.qr,
            userId: user.id, // User comes from Guard
            deviceId: body.deviceId ?? reqCtx.deviceId,
            ipAddress: reqCtx.ipAddress,
            userAgent: reqCtx.userAgent,
        });

        return NextResponse.json(result, { status: 200 });
    } catch (e: unknown) {
        if (e instanceof AppError) {
            return NextResponse.json(
                { error: e.code, message: e.message, details: e.details },
                { status: e.status }
            );
        }

        if (e instanceof Error && e.name === "ZodError") {
            return NextResponse.json(
                { error: "BAD_REQUEST", message: "Payload inválido" },
                { status: 400 }
            );
        }

        console.error("[cards/activate] Error inesperado:", e);
        return NextResponse.json(
            { error: "INTERNAL", message: "Error inesperado" },
            { status: 500 }
        );
    }
}

export const POST = withAuth('activate', 'Card', handler);
