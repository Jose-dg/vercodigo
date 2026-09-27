import { NextRequest, NextResponse } from "next/server";

import { withAuth } from "@/lib/auth/guard";
import type { TokenPayload } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { getAccountStatement } from "@/modules/account-statements/account-statement.service";
import { serializeAccountStatement } from "@/modules/account-statements/serialization";

async function handler(_req: NextRequest, context: { params: Promise<{ id: string }> }, _ability: unknown, user: TokenPayload) {
    try {
        const { id } = await context.params;
        const statement = await getAccountStatement(id, user);
        return NextResponse.json({ statement: serializeAccountStatement(statement) });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
        }
        console.error("[account-statements/detail]", error);
        return NextResponse.json({ error: "INTERNAL", message: "No se pudo cargar el estado de cuenta" }, { status: 500 });
    }
}

export const GET = withAuth("read", "AccountStatement", handler);
