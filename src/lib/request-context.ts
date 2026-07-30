import { NextRequest } from "next/server";
import crypto from "crypto";

export function generateRequestId(): string {
    return crypto.randomUUID();
}

export function extractRequestContext(req: NextRequest) {
    return {
        ipAddress:
            req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
        userAgent: req.headers.get("user-agent") ?? null,
        deviceId: req.headers.get("x-device-id") ?? null,
        requestId: generateRequestId(),
    };
}
