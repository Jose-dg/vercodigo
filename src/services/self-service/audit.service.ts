import prisma from "@/lib/prisma";

export async function writeAuditLog(input: {
    action: string;
    userId: string;
    companyId?: string | null;
    storeId?: string | null;
    entityType?: string | null;
    entityId?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    deviceId?: string | null;
    before?: unknown;
    after?: unknown;
    details?: unknown;
    success?: boolean;
    errorMessage?: string | null;
}) {
    await prisma.auditLog.create({
        data: {
            action: input.action,
            userId: input.userId,
            companyId: input.companyId ?? null,
            storeId: input.storeId ?? null,
            entityType: input.entityType ?? null,
            entityId: input.entityId ?? null,
            ipAddress: input.ipAddress ?? null,
            userAgent: input.userAgent ?? null,
            deviceId: input.deviceId ?? null,
            before: input.before as object | undefined,
            after: input.after as object | undefined,
            details: input.details as object | undefined,
            success: input.success ?? true,
            errorMessage: input.errorMessage ?? null,
        },
    });
}
