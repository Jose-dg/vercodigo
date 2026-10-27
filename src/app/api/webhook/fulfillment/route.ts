import { NextRequest, NextResponse } from "next/server";

import {
    handleDiemFulfillmentWebhook,
    verifyDiemFulfillmentSignature,
} from "@/services/self-service/fulfillment-webhook.service";
import { diagnoseDiemConnection } from "@/lib/devdiem/fulfillment";

export async function POST(request: NextRequest) {
    const rawBody = await request.text();
    const signature = request.headers.get("x-diem-signature");

    if (!verifyDiemFulfillmentSignature(rawBody, signature)) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    try {
        let envelope: unknown;
        try {
            envelope = JSON.parse(rawBody);
        } catch {
            envelope = null;
        }
        if (
            envelope
            && typeof envelope === "object"
            && (envelope as { event_type?: unknown }).event_type === "connection_test"
            && typeof (envelope as { event_id?: unknown }).event_id === "string"
        ) {
            const diagnostic = await diagnoseDiemConnection();
            return NextResponse.json(
                {
                    ...diagnostic,
                    event_id: (envelope as { event_id: string }).event_id,
                },
                { status: 200 },
            );
        }
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
