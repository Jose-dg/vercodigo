import { createHmac, createHash, randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

const leadSchema = z.object({
  audience: z.enum(["stores", "companies"]),
  name: z.string().trim().min(2).max(120),
  role: z.string().trim().min(2).max(120),
  workEmail: z.string().trim().email().max(160),
  whatsapp: optionalText(40),
  companyName: z.string().trim().min(2).max(160),
  country: z.literal("CO"),
  businessType: optionalText(100),
  recipientCountRange: optionalText(40),
  message: optionalText(600),
  consent: z.literal(true),
  website: optionalText(200),
  attribution: z.object({
    landingPath: z.string().trim().max(200),
    referrer: optionalText(500),
    utmSource: optionalText(120),
    utmMedium: optionalText(120),
    utmCampaign: optionalText(160),
    utmContent: optionalText(160),
  }).strict(),
}).strict().superRefine((lead, context) => {
  if (lead.audience === "stores" && !lead.whatsapp) {
    context.addIssue({ code: "custom", path: ["whatsapp"], message: "WhatsApp es obligatorio para tiendas." });
  }
  if (lead.audience === "stores" && !lead.businessType) {
    context.addIssue({ code: "custom", path: ["businessType"], message: "Selecciona el tipo de negocio." });
  }
  if (lead.audience === "companies" && !lead.recipientCountRange) {
    context.addIssue({ code: "custom", path: ["recipientCountRange"], message: "Selecciona un rango de destinatarios." });
  }
});

type RateBucket = { count: number; expiresAt: number };
const rateBuckets = new Map<string, RateBucket>();
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 5;

function isRateLimited(key: string) {
  const now = Date.now();
  const current = rateBuckets.get(key);
  if (!current || current.expiresAt <= now) {
    rateBuckets.set(key, { count: 1, expiresAt: now + RATE_WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > RATE_LIMIT;
}

export async function POST(request: NextRequest) {
  const requestId = randomUUID();
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ ok: false, code: "VALIDATION", message: "Formato de solicitud inválido." }, { status: 400 });
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: "VALIDATION", message: "La solicitud no contiene JSON válido." }, { status: 400 });
  }

  const parsed = leadSchema.safeParse(input);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, code: "VALIDATION", message: "Revisa los campos señalados.", fieldErrors: z.flattenError(parsed.error).fieldErrors },
      { status: 422 },
    );
  }

  if (parsed.data.website) {
    return NextResponse.json({ ok: true, message: "Solicitud recibida.", requestId }, { status: 201 });
  }

  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const emailHash = createHash("sha256").update(parsed.data.workEmail.toLowerCase()).digest("hex");
  if (isRateLimited(`ip:${forwardedFor}`) || isRateLimited(`email:${emailHash}`)) {
    return NextResponse.json(
      { ok: false, code: "RATE_LIMITED", message: "Recibimos varios intentos. Espera unos minutos o escríbenos por WhatsApp." },
      { status: 429 },
    );
  }

  const webhookUrl = process.env.LEADS_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json(
      { ok: false, code: "DELIVERY_UNAVAILABLE", message: "El formulario aún no está conectado. Escríbenos por WhatsApp para continuar." },
      { status: 503 },
    );
  }

  const body = JSON.stringify({ ...parsed.data, requestId, submittedAt: new Date().toISOString(), formVersion: "2026-09-24" });
  const signature = process.env.LEADS_WEBHOOK_SECRET
    ? createHmac("sha256", process.env.LEADS_WEBHOOK_SECRET).update(body).digest("hex")
    : undefined;

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Vercode-Request-Id": requestId,
        ...(signature ? { "X-Vercode-Signature": `sha256=${signature}` } : {}),
      },
      body,
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });

    if (!response.ok) throw new Error(`Webhook returned ${response.status}`);
    return NextResponse.json(
      { ok: true, message: "Recibimos tu solicitud. El equipo comercial revisará la información y se pondrá en contacto.", requestId },
      { status: 201 },
    );
  } catch (error) {
    console.error("Lead delivery failed", {
      requestId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { ok: false, code: "DELIVERY_UNAVAILABLE", message: "No pudimos entregar la solicitud en este momento. Escríbenos por WhatsApp para continuar." },
      { status: 503 },
    );
  }
}
