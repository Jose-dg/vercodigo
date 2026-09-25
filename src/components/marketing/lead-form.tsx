"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2, Loader2, MessageCircle } from "lucide-react";

import { marketingConfig } from "@/lib/marketing/config";

type LeadFormProps = {
  audience?: "stores" | "companies";
};

type FormStatus = "idle" | "loading" | "success" | "error";

export function LeadForm({ audience = "stores" }: LeadFormProps) {
  const [status, setStatus] = useState<FormStatus>("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setStatus("loading");
    setMessage("");

    const params = new URLSearchParams(window.location.search);
    const payload = {
      audience,
      name: data.get("name"),
      role: data.get("role"),
      workEmail: data.get("workEmail"),
      whatsapp: data.get("whatsapp"),
      companyName: data.get("companyName"),
      country: "CO",
      businessType: data.get("businessType"),
      recipientCountRange: data.get("recipientCountRange"),
      message: data.get("message"),
      consent: data.get("consent") === "on",
      website: data.get("website"),
      attribution: {
        landingPath: window.location.pathname,
        referrer: document.referrer,
        utmSource: params.get("utm_source") || undefined,
        utmMedium: params.get("utm_medium") || undefined,
        utmCampaign: params.get("utm_campaign") || undefined,
        utmContent: params.get("utm_content") || undefined,
      },
    };

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "No fue posible enviar la solicitud.");
      form.reset();
      setStatus("success");
      setMessage(body.message);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "No fue posible enviar la solicitud.");
    }
  }

  const isCompanies = audience === "companies";

  return (
    <form onSubmit={submit} className="grid gap-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Nombre" name="name" autoComplete="name" required />
        <Field label="Cargo" name="role" autoComplete="organization-title" required />
        <Field label="Correo corporativo" name="workEmail" type="email" autoComplete="email" required />
        <Field label="WhatsApp" name="whatsapp" type="tel" autoComplete="tel" required={!isCompanies} />
        <Field label="Empresa" name="companyName" autoComplete="organization" required />
        {isCompanies ? (
          <SelectField
            label="Número aproximado de destinatarios"
            name="recipientCountRange"
            options={["1–20", "21–50", "51–100", "Más de 100"]}
          />
        ) : (
          <SelectField
            label="Tipo de negocio"
            name="businessType"
            options={["Tienda de tecnología", "Tienda de videojuegos", "Comercio minorista", "Otro"]}
          />
        )}
      </div>

      <div>
        <label htmlFor={`${audience}-message`} className="marketing-field-label">Mensaje opcional</label>
        <textarea
          id={`${audience}-message`}
          name="message"
          maxLength={600}
          rows={4}
          className="marketing-field mt-2 min-h-28 resize-y py-3"
          placeholder={isCompanies ? "Cuéntanos la ocasión y la fecha esperada." : "Cuéntanos sobre tus locales o el tipo de códigos que buscas."}
        />
      </div>

      <div className="absolute -left-[10000px]" aria-hidden="true">
        <label htmlFor={`${audience}-website`}>Sitio web</label>
        <input id={`${audience}-website`} name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <label className="flex items-start gap-3 text-sm leading-6 text-[#526a6e]">
        <input
          type="checkbox"
          name="consent"
          required
          className="mt-1 size-4 rounded border-[#9eb0ad] accent-[#2457d6]"
        />
        <span>Acepto que Vercode use estos datos para responder esta solicitud comercial.</span>
      </label>

      <button
        type="submit"
        disabled={status === "loading"}
        className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#2457d6] px-6 text-sm font-semibold text-white hover:bg-[#1d46ad] disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2457d6]"
      >
        {status === "loading" && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {status === "loading" ? "Enviando…" : "Solicitar cuenta"}
      </button>

      {message && (
        <div
          role={status === "error" ? "alert" : "status"}
          className={`rounded-xl border p-4 text-sm leading-6 ${
            status === "success"
              ? "border-[#a9d4bf] bg-[#edf8f1] text-[#205c3d]"
              : "border-[#e6b8ae] bg-[#fff4f1] text-[#8f3026]"
          }`}
        >
          <div className="flex items-start gap-2">
            {status === "success" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : null}
            <span>{message}</span>
          </div>
          {status === "error" && marketingConfig.contact.whatsappUrl !== "#solicitar-cuenta" && (
            <a href={marketingConfig.contact.whatsappUrl} className="mt-3 inline-flex items-center gap-2 font-semibold underline underline-offset-4">
              <MessageCircle className="size-4" /> Escribir por WhatsApp
            </a>
          )}
        </div>
      )}
    </form>
  );
}
function Field({ label, name, type = "text", ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) {
  return (
    <div>
      <label htmlFor={name} className="marketing-field-label">{label}</label>
      <input id={name} name={name} type={type} maxLength={120} className="marketing-field mt-2" {...props} />
    </div>
  );
}

function SelectField({ label, name, options }: { label: string; name: string; options: string[] }) {
  return (
    <div>
      <label htmlFor={name} className="marketing-field-label">{label}</label>
      <select id={name} name={name} required className="marketing-field mt-2">
        <option value="">Selecciona una opción</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </div>
  );
}
