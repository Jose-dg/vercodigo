import prisma from '@/lib/prisma';

export async function getAllScanLogs(filters?: {
    cardId?: string;
    wasSuccess?: boolean;
    startDate?: Date;
    endDate?: Date;
}) {
    const where: any = {};

    if (filters?.cardId) {
        where.cardId = filters.cardId;
    }

    if (filters?.wasSuccess !== undefined) {
        where.wasSuccess = filters.wasSuccess;
    }

    if (filters?.startDate || filters?.endDate) {
        where.scannedAt = {};
        if (filters.startDate) {
            where.scannedAt.gte = filters.startDate;
        }
        if (filters.endDate) {
            where.scannedAt.lte = filters.endDate;
        }
    }

    return prisma.scanLog.findMany({
        where,
        include: {
            card: {
                include: {
                    product: true,
                    store: {
                        include: {
                            company: true,
                        },
                    },
                },
            },
        },
        orderBy: {
            scannedAt: 'desc',
        },
        take: 1000, // Limit to prevent performance issues
    });
}

export async function getScanLogStats(filters?: {
    cardId?: string;
    startDate?: Date;
    endDate?: Date;
}) {
    const where: any = {};

    if (filters?.cardId) {
        where.cardId = filters.cardId;
    }

    if (filters?.startDate || filters?.endDate) {
        where.scannedAt = {};
        if (filters.startDate) {
            where.scannedAt.gte = filters.startDate;
        }
        if (filters.endDate) {
            where.scannedAt.lte = filters.endDate;
        }
    }

    const [
        totalScans,
        successfulScans,
        failedScans,
    ] = await Promise.all([
        prisma.scanLog.count({ where }),
        prisma.scanLog.count({ where: { ...where, wasSuccess: true } }),
        prisma.scanLog.count({ where: { ...where, wasSuccess: false } }),
    ]);

    return {
        totalScans,
        successfulScans,
        failedScans,
        successRate: totalScans > 0 ? successfulScans / totalScans : 0,
    };
}

