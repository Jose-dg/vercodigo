import { NextRequest, NextResponse } from "next/server";

import {
    handleDiemFulfillmentWebhook,
    verifyDiemFulfillmentSignature,
} from "@/services/self-service/fulfillment-webhook.service";

export async function POST(request: NextRequest) {
    const rawBody = await request.text();
    const signature = request.headers.get("x-diem-signature");

    if (!verifyDiemFulfillmentSignature(rawBody, signature)) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    try {
        const result = await handleDiemFulfillmentWebhook(rawBody);
        if (!result.ok) {
            return NextResponse.json(
                { error: result.reason || "invalid_payload" },
                { status: 400 },
            );
        }
        return NextResponse.json({ success: true, ...result }, { status: 200 });
    } catch (error) {
        console.error("[webhook/fulfillment]", error instanceof Error ? error.message : error);
        return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
    }
}
