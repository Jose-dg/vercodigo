import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const LOCK_TTL_MINUTES = 5;

/**
 * POST /api/cards/release-stale-locks
 *
 * Libera locks que llevan más de LOCK_TTL_MINUTES sin completar.
 * Esto maneja el caso donde un operador cierra el navegador
 * o pierde conexión durante el proceso de activación.
 *
 * Puede ejecutarse via cron o manualmente.
 */
export async function POST() {
    try {
        const cutoff = new Date(Date.now() - LOCK_TTL_MINUTES * 60 * 1000);

        const released = await prisma.card.updateMany({
            where: {
                activationLock: true,
                activationLockAt: { lt: cutoff },
                isActivated: false,
            },
            data: {
                activationLock: false,
                activationLockBy: null,
                activationLockAt: null,
            },
        });

        return NextResponse.json({
            released: released.count,
            ttlMinutes: LOCK_TTL_MINUTES,
            timestamp: new Date().toISOString(),
        });
    } catch (e: unknown) {
        console.error("[release-stale-locks] Error:", e);
        return NextResponse.json(
            { error: "INTERNAL", message: "Error liberando locks" },
            { status: 500 }
        );
    }
}
