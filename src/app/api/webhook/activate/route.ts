import { NextResponse } from "next/server";

/**
 * Retired n8n/WhatsApp activation webhook. It activated cards and debited the
 * company wallet without Diem fulfillment and without enforcing a signature.
 * QR activations go through activateCard (Diem code request) only. No caller
 * remained and production never recorded a phone-based activation.
 */
export function POST() {
    return NextResponse.json(
        { error: "GONE", message: "Las activaciones se hacen desde diem-sas con fulfillment de Diem." },
        { status: 410 },
    );
}
