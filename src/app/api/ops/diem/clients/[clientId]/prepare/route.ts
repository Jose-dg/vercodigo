import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/auth/guard";
import { isPlatformRole } from "@/lib/auth/abilities";
import { badRequest, forbidden } from "@/lib/errors";
import { prepareOpsClient } from "@/lib/devdiem/ops";

const Body = z.object({
    legalName: z.string().min(1),
    partyType: z.enum(["natural_person", "legal_entity"]),
    tradeName: z.string().optional(),
    identityConfirmed: z.literal(true),
});

async function handler(
    req: NextRequest,
    context: { params: Promise<{ clientId: string }> },
    _ability: unknown,
    user: { role: string },
) {
    if (!isPlatformRole(user.role as "SUPER_ADMIN" | "SYSTEM_ADMIN")) {
        throw forbidden("Solo plataforma puede clasificar clientes Diem");
    }
    const { clientId } = await context.params;
    const id = Number(clientId);
    if (!Number.isFinite(id) || id < 1) {
        throw badRequest("clientId inválido");
    }
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
        throw badRequest("Payload inválido", parsed.error.issues);
    }
    const result = await prepareOpsClient({
        clientId: id,
        legalName: parsed.data.legalName,
        partyType: parsed.data.partyType,
        tradeName: parsed.data.tradeName,
    });
    return NextResponse.json(result);
}

export const POST = withAuth("manage", "Product", handler);
