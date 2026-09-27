import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withAuth } from "@/lib/auth/guard";
import type { TokenPayload } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { issueAccountStatement, listAccountStatements } from "@/modules/account-statements/account-statement.service";
import { serializeAccountStatement } from "@/modules/account-statements/serialization";

const IssueBody = z.object({
    companyId: z.string().min(1),
    cutoffAt: z.coerce.date(),
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
});

async function listHandler(_req: NextRequest, _ctx: unknown, _ability: unknown, user: TokenPayload) {
    try {
        const statements = await listAccountStatements(user);
        return NextResponse.json({ statements });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
        }
        console.error("[account-statements/list]", error);
        return NextResponse.json({ error: "INTERNAL", message: "No se pudieron cargar los estados de cuenta" }, { status: 500 });
    }
}

async function createHandler(req: NextRequest, _ctx: unknown, _ability: unknown, user: TokenPayload) {
    try {
        const body = IssueBody.safeParse(await req.json());
        if (!body.success) {
            return NextResponse.json({ error: "BAD_REQUEST", message: "Datos de emisión inválidos", details: body.error.issues }, { status: 400 });
        }
        const statement = await issueAccountStatement({ ...body.data, actor: user });
        return NextResponse.json({ statement: serializeAccountStatement(statement) }, { status: 201 });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json({ error: error.code, message: error.message, details: error.details }, { status: error.status });
        }
        console.error("[account-statements/create]", error);
        return NextResponse.json({ error: "INTERNAL", message: "No se pudo emitir el estado de cuenta" }, { status: 500 });
    }
}

export const GET = withAuth("read", "AccountStatement", listHandler);
export const POST = withAuth("create", "AccountStatement", createHandler);
