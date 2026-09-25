import type { Metadata } from "next";
import { ArrowRight, BriefcaseBusiness, CalendarDays, Gift, MessageCircle, Users } from "lucide-react";

import { LeadForm } from "@/components/marketing/lead-form";
import { MarketingFooter } from "@/components/marketing/site-footer";
import { MarketingHeader } from "@/components/marketing/site-header";
import { marketingConfig } from "@/lib/marketing/config";

export const metadata: Metadata = {
  title: "Soluciones para empresas | Vercode",
  description: "Códigos digitales y tarjetas con QR para reconocimientos, incentivos y campañas empresariales.",
  alternates: { canonical: "/empresas" },
  openGraph: {
    title: "Vercode para empresas",
    description: "Gestiona regalos e incentivos digitales desde una solicitud comercial.",
    url: "/empresas",
    siteName: "Vercode",
    locale: "es_CO",
    type: "website",
  },
};

const useCases = [
  [Gift, "Reconocimientos", "Celebra logros y fechas importantes."],
  [Users, "Equipos y aliados", "Coordina opciones para grupos desde una sola conversación."],
  [CalendarDays, "Campañas y temporadas", "Planea cantidades y fecha de entrega con anticipación."],
] as const;

const process = [
  ["Solicita", "Indica destinatarios, presupuesto y fecha."],
  ["Confirma", "Recibe opciones disponibles para tu necesidad."],
  ["Coordina", "Define códigos digitales o tarjetas físicas con QR."],
  ["Entrega", "Distribuye la opción acordada a tu equipo o clientes."],
] as const;

export default function CompaniesPage() {
  return (
    <div className="marketing-page">
      <MarketingHeader />
      <main>
        <section className="marketing-hero">
          <div className="marketing-container grid gap-12 py-16 lg:grid-cols-[1fr_0.82fr] lg:items-center lg:py-24">
            <div>
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#cad7d4] bg-white px-3 py-1.5 text-sm text-[#3d5b60]">
                <BriefcaseBusiness className="size-4 text-[#2457d6]" /> Compras corporativas
              </div>
              <h1 className="max-w-3xl text-4xl font-bold leading-[1.04] tracking-[-0.055em] text-[#12333a] sm:text-6xl">
                Regalos digitales para equipos y clientes, gestionados desde una sola solicitud.
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-[#466267]">
                Define cantidad, presupuesto y fecha. Vercode confirma las opciones disponibles para Colombia y acompaña la entrega acordada.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <a href="#solicitud-empresas" className="marketing-button-primary">Solicitar opciones <ArrowRight className="size-4" /></a>
                <a href={marketingConfig.contact.whatsappUrl} className="marketing-button-secondary"><MessageCircle className="size-4" /> Escribir por WhatsApp</a>
              </div>
            </div>

            <div className="rounded-[2rem] border border-[#cbd8d5] bg-white p-7 shadow-[0_30px_90px_rgba(18,51,58,0.10)] sm:p-10">
              <p className="text-sm font-medium text-[#61777a]">Una compra, distintos momentos</p>
              <div className="mt-8 divide-y divide-[#dce5e2]">
                {useCases.map(([Icon, title, copy]) => (
                  <div key={title} className="flex gap-4 py-5 first:pt-0 last:pb-0">
                    <Icon className="mt-1 size-5 shrink-0 text-[#2457d6]" />
                    <div><h2 className="font-semibold text-[#12333a]">{title}</h2><p className="mt-1 text-sm leading-6 text-[#61777a]">{copy}</p></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="marketing-section bg-white">
          <div className="marketing-container">
            <div className="marketing-section-heading"><h2>Un proceso comercial, no un catálogo genérico.</h2><p>La disponibilidad se confirma según marca, región, cantidad y fecha requerida.</p></div>
            <ol className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-[#cbd8d5] bg-[#cbd8d5] md:grid-cols-4">
              {process.map(([title, copy], index) => (
                <li key={title} className="bg-[#f8faf9] p-7"><span className="text-sm font-semibold text-[#2457d6]">{index + 1}</span><h3 className="mt-8 text-xl font-semibold text-[#12333a]">{title}</h3><p className="mt-3 text-sm leading-6 text-[#61777a]">{copy}</p></li>
              ))}
            </ol>
          </div>
        </section>

        <section id="solicitud-empresas" className="marketing-section bg-[#e7edf9]">
          <div className="marketing-container grid gap-12 lg:grid-cols-[0.72fr_1.28fr]">
            <div><h2 className="text-3xl font-semibold tracking-[-0.045em] text-[#12333a] sm:text-5xl">Cuéntanos qué quieres reconocer.</h2><p className="mt-5 leading-7 text-[#526a6e]">El equipo comercial revisará cantidad, fecha y catálogo disponible antes de confirmar una propuesta.</p></div>
            <div className="rounded-2xl bg-white p-6 shadow-[0_24px_70px_rgba(18,51,58,0.09)] sm:p-9"><LeadForm audience="companies" /></div>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
