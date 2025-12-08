import prisma from '@/lib/prisma';

// Simple in-memory cache for demo purposes
// In production, use Redis
const cache = new Map<string, { data: any; expires: number }>();

export function getCached<T>(key: string): T | null {
    const item = cache.get(key);
    if (!item || Date.now() > item.expires) {
        cache.delete(key);
        return null;
    }
    return item.data as T;
}

export function setCache<T>(key: string, data: T, ttlMs = 60000) {
    cache.set(key, { data, expires: Date.now() + ttlMs });
}

export async function getDashboardStats(storeId: string) {
    const cacheKey = `dashboard:${storeId}`;
    const cached = getCached(cacheKey);

    if (cached) return cached;

    const stats = await prisma.card.groupBy({
        by: ['isActivated'],
        where: { storeId },
        _count: true,
    });

    setCache(cacheKey, stats, 5 * 60 * 1000); // 5 minutos
    return stats;
}
