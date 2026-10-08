import { Prisma } from "@prisma/client";

type TransactionHost = {
    $transaction<T>(
        work: (tx: Prisma.TransactionClient) => Promise<T>,
        options: {
            isolationLevel: Prisma.TransactionIsolationLevel;
            maxWait: number;
            timeout: number;
        },
    ): Promise<T>;
};

type SerializableOptions = {
    maxAttempts?: number;
    maxWaitMs?: number;
    timeoutMs?: number;
    baseDelayMs?: number;
    retryOn?: (error: unknown) => boolean;
};

export function isPrismaWriteConflict(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}

export async function runSerializableTransaction<T>(
    host: TransactionHost,
    work: (tx: Prisma.TransactionClient) => Promise<T>,
    options: SerializableOptions = {},
): Promise<T> {
    const maxAttempts = options.maxAttempts ?? 3;
    const baseDelayMs = options.baseDelayMs ?? 25;
    const retryOn = options.retryOn ?? isPrismaWriteConflict;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        try {
            return await host.$transaction(work, {
                isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
                maxWait: options.maxWaitMs ?? 5_000,
                timeout: options.timeoutMs ?? 10_000,
            });
        } catch (error) {
            if (!retryOn(error) || attempt >= maxAttempts - 1) throw error;
            const exponentialDelay = baseDelayMs * (2 ** attempt);
            const jitter = baseDelayMs > 0 ? Math.floor(Math.random() * baseDelayMs) : 0;
            await new Promise((resolve) => setTimeout(resolve, exponentialDelay + jitter));
        }
    }

    throw new Error("No se pudo completar la transacción serializable");
}
