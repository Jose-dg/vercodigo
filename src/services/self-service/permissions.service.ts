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

    const sameCompany = user.companyId && user.companyId === params.companyId;
    const sameStore = user.storeId && user.storeId === params.storeId;

    const allowed =
        user.role === "SUPER_ADMIN" ||
        user.role === "SYSTEM_ADMIN" ||
        ((user.role === "OWNER" || user.role === "GENERAL_ADMIN") && sameCompany) ||
        ((user.role === "ADMIN" || user.role === "OPERATOR") && sameStore);

    if (!allowed)
        throw forbidden("No tienes permisos para operar en esta tienda.");

    return user;
}
