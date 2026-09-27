import React from "react";
import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";

import { withAuth } from "@/lib/auth/guard";
import type { TokenPayload } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { getAccountStatement } from "@/modules/account-statements/account-statement.service";
import { AccountStatementDocument } from "@/modules/account-statements/account-statement-pdf";

export const runtime = "nodejs";

async function handler(_req: NextRequest, context: { params: Promise<{ id: string }> }, _ability: unknown, user: TokenPayload) {
    try {
        const { id } = await context.params;
        const statement = await getAccountStatement(id, user);
        const buffer = await renderToBuffer(<AccountStatementDocument statement={statement} />);
        return new NextResponse(new Uint8Array(buffer), {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="${statement.statementNumber}.pdf"`,
                "Cache-Control": "private, no-store",
                "X-Robots-Tag": "noindex, nofollow",
            },
        });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
        }
        console.error("[account-statements/pdf]", error);
        return NextResponse.json({ error: "INTERNAL", message: "No se pudo generar el PDF" }, { status: 500 });
    }
}

export const GET = withAuth("read", "AccountStatement", handler);
