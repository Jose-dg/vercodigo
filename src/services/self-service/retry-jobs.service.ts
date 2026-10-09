import prisma from "@/lib/prisma";

/**
 * Read-only triage of FAILED activation jobs.
 *
 * FAILED is an absorbing state: reopening a job here would race with the
 * partner webhook and could finalize a card without its wallet movement.
 * A failed activation is retried by starting a new activation from the card,
 * which creates a fresh, idempotent job. This report only surfaces what an
 * operator must look at, including failed jobs whose card is nevertheless
 * activated (an inconsistency to investigate, never to auto-complete).
 */
export async function retryFailedJobs() {
    const failedJobs = await prisma.activationJob.findMany({
        where: { status: "FAILED" },
        orderBy: { updatedAt: "desc" },
        take: 50,
        select: {
            id: true,
            attempts: true,
            lastError: true,
            diemRequestId: true,
            card: { select: { uuid: true, isActivated: true } },
        },
    });

    return failedJobs.map((job) => ({
        jobId: job.id,
        cardUuid: job.card.uuid,
        attempts: job.attempts,
        lastError: job.lastError,
        diemRequestId: job.diemRequestId,
        status: job.card.isActivated ? "INCONSISTENT_CARD_ACTIVATED" : "MANUAL_RETRY_FROM_CARD",
    }));
}
