import crypto from "crypto";

export function verifyDiemFulfillmentSignature(body: string, signature: string | null): boolean {
    const secret = process.env.DIEM_FULFILLMENT_WEBHOOK_SECRET?.trim();
    if (!secret) {
        // Local development may run without the shared secret; production never may.
        return process.env.NODE_ENV !== "production";
    }
    if (!signature) return false;
    const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
    const provided = signature.trim().toLowerCase();
    const expectedBuf = Buffer.from(expected, "utf8");
    const providedBuf = Buffer.from(provided, "utf8");
    if (expectedBuf.length !== providedBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, providedBuf);
}
