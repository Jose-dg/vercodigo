import { NextRequest, NextResponse } from "next/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";

import prisma from "@/lib/prisma";
import { planProfileSync } from "@/modules/identity/domain";
import { writeAuditLog } from "@/services/self-service/audit.service";

/**
 * POST /api/webhook/clerk — la persona editó su perfil en Clerk (correo, nombre o
 * contraseña). Se copian correo y nombre a la base y, si cambió la clave que le
 * asignó un admin, se apaga el aviso. Rol, empresa y sede nunca vienen de Clerk.
 * Firma svix con CLERK_WEBHOOK_SIGNING_SECRET. Responde 200 a lo que no aplica para
 * que Clerk no lo reintente.
 */
export async function POST(request: NextRequest) {
    let event;
    try {
        event = await verifyWebhook(request);
    } catch {
        return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
    }
    if (event.type !== "user.updated") return NextResponse.json({ success: true, ignored: true });

    const data = event.data;
    const user = await prisma.user.findUnique({
        where: { clerkUserId: data.id },
        select: { id: true, email: true, name: true, passwordAssignedAt: true, companyId: true, storeId: true },
    });
    if (!user) return NextResponse.json({ success: true, ignored: true });

    const primary = data.email_addresses.find((address) => address.id === data.primary_email_address_id);
    const sync = planProfileSync(user, {
        primaryEmail: primary?.email_address ?? null,
        firstName: data.first_name,
        lastName: data.last_name,
        passwordLastUpdatedAt: data.password_last_updated_at,
    });
    if (!sync) return NextResponse.json({ success: true, unchanged: true });

    // Otro usuario del portal ya usa ese correo: se conserva el actual y se deja rastro.
    let emailConflict = false;
    if (sync.email) {
        const owner = await prisma.user.findUnique({ where: { email: sync.email }, select: { id: true } });
        if (owner && owner.id !== user.id) {
            emailConflict = true;
            console.error("[webhook/clerk] correo en uso por otro usuario", { userId: user.id, email: sync.email });
            delete sync.email;
        }
    }

    const changes = {
        ...(sync.email ? { email: sync.email } : {}),
        ...(sync.name ? { name: sync.name } : {}),
        ...(sync.clearPasswordAssigned ? { passwordAssignedAt: null } : {}),
    };
    if (Object.keys(changes).length > 0) {
        await prisma.user.update({ where: { id: user.id }, data: changes });
    }
    await writeAuditLog({
        action: "user.profile_synced_from_clerk",
        userId: user.id,
        companyId: user.companyId,
        storeId: user.storeId,
        entityType: "User",
        entityId: user.id,
        before: { email: user.email, name: user.name, passwordAssigned: user.passwordAssignedAt !== null },
        after: changes,
        success: !emailConflict,
        errorMessage: emailConflict ? "El correo nuevo ya pertenece a otro usuario del portal" : null,
    });
    return NextResponse.json({ success: true });
}
