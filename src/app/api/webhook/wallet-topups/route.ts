import { NextRequest, NextResponse } from "next/server";

import {
    handleTopUpStateWebhook,
    parseTopUpStateWebhook,
} from "@/services/wallet/gateway-topup.service";
import { verifyDiemFulfillmentSignature } from "@/services/self-service/fulfillment-webhook.service";

/**
 * POST /api/webhook/wallet-topups — DevDiem announces that a company top-up
 * was credited or failed (signed with the partner secret). The wallet is
 * updated right away; statement-closing synchronization stays as the safety net.
 */
export async function POST(request: NextRequest) {
    const rawBody = await request.text();
    if (!verifyDiemFulfillmentSignature(rawBody, request.headers.get("x-diem-signature"))) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    let event;
    try {
        event = parseTopUpStateWebhook(JSON.parse(rawBody));
    } catch {
        event = null;
    }
    if (!event) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });

    try {
        const result = await handleTopUpStateWebhook(event);
        if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 404 });
        return NextResponse.json({ success: true, state: result.state }, { status: 200 });
    } catch (error) {
        // DevDiem retries 5xx; statement closing covers anything still missed.
        console.error("[webhook/wallet-topups]", error instanceof Error ? error.message : error);
        return NextResponse.json({ error: "INTERNAL" }, { status: 503 });
    }
}
