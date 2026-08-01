import prisma from "@/lib/prisma";
import { forbidden } from "@/lib/errors";

export async function assertCanActivateCard(params: {
    userId: string;
    storeId: string;
    companyId: string;
}) {
    const user = await prisma.user.findUnique({
        where: { id: params.userId },
        select: {
            id: true,
            isActive: true,
            role: true,
            storeId: true,
            companyId: true,
        },
    });

    if (!user || !user.isActive)
        throw forbidden("Usuario inactivo o no existe.");

    const sameCompany = Boolean(user.companyId && user.companyId === params.companyId);
    const sameStore = Boolean(user.storeId && user.storeId === params.storeId);

    const allowed =
        user.role === "SUPER_ADMIN" ||
        user.role === "SYSTEM_ADMIN" ||
        ((user.role === "OWNER" || user.role === "GENERAL_ADMIN") && sameCompany) ||
        ((user.role === "ADMIN" || user.role === "OPERATOR") && sameStore);

    if (!allowed) {
        if (
            (user.role === "OWNER" || user.role === "GENERAL_ADMIN")
            && user.companyId
            && !sameCompany
        ) {
            const storeCompany = await prisma.company.findUnique({
                where: { id: params.companyId },
                select: { name: true },
            });
            const userCompany = await prisma.company.findUnique({
                where: { id: user.companyId },
                select: { name: true },
            });
            throw forbidden(
                `Esta tarjeta pertenece a ${storeCompany?.name ?? "otra compañía"}. `
                + `Tu perfil está en ${userCompany?.name ?? "otra compañía"}.`,
            );
        }
        throw forbidden("No tienes permisos para operar en esta tienda.");
    }

    return user;
}
