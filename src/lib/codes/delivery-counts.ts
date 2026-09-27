export function summarizeCodeDelivery(params: {
    status: string;
    billedCount?: number;
    deliveredCodes: unknown;
}) {
    const codes = Array.isArray(params.deliveredCodes)
        ? params.deliveredCodes.filter((code): code is string => typeof code === "string")
        : [];
    return {
        codes,
        deliveredCodeCount: codes.length,
        hasDeliveryCountMismatch:
            params.status === "COMPLETED"
            && typeof params.billedCount === "number"
            && params.billedCount !== codes.length,
    };
}
