import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/auth/guard";
import { isPlatformRole } from "@/lib/auth/abilities";
import { badRequest, forbidden } from "@/lib/errors";
import { setOpsStoreProductFulfillment } from "@/lib/devdiem/ops";

const Body = z.object({
    enabled: z.boolean(),
});

async function handler(
    req: NextRequest,
    context: { params: Promise<{ storeProductId: string }> },
    _ability: unknown,
    user: { role: string },
) {
    if (!isPlatformRole(user.role as "SUPER_ADMIN" | "SYSTEM_ADMIN")) {
        throw forbidden("Solo plataforma puede activar fulfillment");
    }
    const { storeProductId } = await context.params;
    if (!storeProductId) {
        throw badRequest("storeProductId inválido");
    }
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
        throw badRequest("Payload inválido", parsed.error.issues);
    }
    const result = await setOpsStoreProductFulfillment({
        storeProductId,
        enabled: parsed.data.enabled,
    });
    return NextResponse.json(result);
}

export const POST = withAuth("manage", "Product", handler);
