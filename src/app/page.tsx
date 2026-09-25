import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight, BadgeCheck, BookOpenText, Building2, Check,
  CircleDollarSign, KeyRound, MapPin, MessageCircle, ScanLine,
  ShieldCheck, Store, Users,
} from "lucide-react";

import { CardDemo } from "@/components/marketing/card-demo";
import { LeadForm } from "@/components/marketing/lead-form";
import { RedemptionLookup } from "@/components/marketing/redemption-lookup";
import { MarketingFooter } from "@/components/marketing/site-footer";
import { MarketingHeader } from "@/components/marketing/site-header";
import { marketingConfig } from "@/lib/marketing/config";

export const metadata: Metadata = {
  title: "Vercode | Códigos digitales y tarjetas con QR para tu negocio",
  description: marketingConfig.brand.description,
  alternates: { canonical: "/" },
  openGraph: {
    title: "Vercode para negocios",
    description: marketingConfig.brand.description,
    url: "/",
    siteName: "Vercode",
    locale: "es_CO",
    type: "website",
  },
};

const howItWorks = [
  ["Solicita tu cuenta", "Cuéntanos sobre tu empresa y el equipo comercial revisará la solicitud."],
  ["Define tu operación", "Organiza usuarios y locales según la forma en que trabaja tu negocio."],
  ["Compra o activa", "Solicita códigos digitales o activa tarjetas con QR al momento de vender."],
  ["Entrega a tu cliente", "Comparte el código o permite que el comprador lo consulte desde su tarjeta."],
] as const;

const faqs = [
  ["¿Vercode vende al consumidor final?", "No. Vercode trabaja con empresas y comercios. La página de tarjeta existe para que el comprador consulte un producto que ya recibió de una tienda."],
  ["¿Qué ve una persona al escanear una tarjeta inactiva?", "Ve una indicación para contactar a la tienda. El código no se presenta mientras la tarjeta permanece inactiva."],
  ["¿Cómo funciona el saldo?", "Cada cuenta puede operar con saldo prepago o con crédito previamente aprobado, según sus condiciones comerciales."],
  ["¿La entrega siempre es inmediata?", "La entrega es automática cuando el producto está disponible. Si una solicitud requiere revisión o no tiene disponibilidad, el equipo brinda soporte."],
  ["¿Por qué importa la región del código?", "Los códigos pueden estar limitados a una región o país. La opción correcta debe coincidir con la cuenta en la que será canjeado."],
  ["¿Dónde opera Vercode?", "La operación pública disponible actualmente es Colombia."],
] as const;

export default function HomePage() {
  const catalog = marketingConfig.catalog;

  return (
    <div className="marketing-page">
      <MarketingHeader />
      <main>
        <section className="marketing-hero">
          <div className="marketing-container grid items-center gap-14 py-16 lg:grid-cols-[1.08fr_0.92fr] lg:py-24">
            <div>
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#cad7d4] bg-white px-3 py-1.5 text-sm text-[#3d5b60]">
                <MapPin aria-hidden="true" className="size-4 text-[#2457d6]" /> Operación B2B en Colombia
              </div>
              <h1 className="max-w-3xl text-4xl font-bold leading-[1.04] tracking-[-0.055em] text-[#12333a] sm:text-6xl lg:text-[4.4rem]">
                Códigos digitales y tarjetas con QR para vender en tu negocio.
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-[#466267]">
                Compra códigos o activa tarjetas al momento de la venta. Controla usuarios, saldo y movimientos desde una sola cuenta.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <a href="#solicitar-cuenta" className="marketing-button-primary">Solicitar cuenta <ArrowRight aria-hidden="true" className="size-4" /></a>
                <a href={marketingConfig.contact.whatsappUrl} className="marketing-button-secondary"><MessageCircle aria-hidden="true" className="size-4" /> Escribir por WhatsApp</a>
              </div>
              <p className="mt-5 max-w-xl text-sm leading-6 text-[#61777a]">
                Entrega automática según disponibilidad. Condiciones de saldo prepago o crédito aprobado para cada cuenta.
              </p>
              <div className="mt-10 max-w-2xl border-t border-[#d4dfdc] pt-6"><RedemptionLookup /></div>
            </div>
            <CardDemo />
          </div>
        </section>

        <section aria-label="Catálogo" className="border-y border-[#dce5e2] bg-white">
          <div className="marketing-container flex flex-col gap-5 py-7 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-semibold text-[#12333a]">Catálogo configurado para cada cuenta</p>
              <p className="mt-1 text-sm text-[#61777a]">Marcas, región y disponibilidad se confirman durante la apertura.</p>
            </div>
            {catalog.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {catalog.map((item) => <span key={item.name} className="rounded-full border border-[#cad7d4] px-3 py-1.5 text-sm text-[#345158]">{item.name}{item.status === "coming_soon" ? " · Próximamente" : ""}</span>)}
              </div>
            ) : (
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[#eef2fb] px-3 py-1.5 text-sm font-medium text-[#244aa6]"><BadgeCheck className="size-4" /> Consulta disponibilidad comercial</span>
            )}
          </div>
        </section>

        <section id="como-funciona" className="marketing-section">
          <div className="marketing-container">
            <div className="marketing-section-heading"><h2>Una operación clara desde la primera venta.</h2><p>El proceso separa la apertura comercial de la operación diaria de tu equipo.</p></div>
            <ol className="mt-12 grid border-y border-[#cbd8d5] md:grid-cols-4">
              {howItWorks.map(([title, copy], index) => (
                <li key={title} className="border-b border-[#cbd8d5] py-7 md:border-b-0 md:border-r md:px-6 md:first:pl-0 md:last:border-r-0 md:last:pr-0">
                  <span className="text-sm font-semibold text-[#2457d6]">{index + 1}</span>
                  <h3 className="mt-7 text-xl font-semibold tracking-[-0.03em] text-[#12333a]">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#5c7377]">{copy}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="tarjetas" className="marketing-section bg-[#12333a] text-white">
          <div className="marketing-container grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div><p className="max-w-xl text-3xl font-semibold leading-tight tracking-[-0.045em] sm:text-5xl">Dos formas de vender. Una sola operación.</p><p className="mt-6 max-w-lg text-base leading-7 text-white/65">Elige el formato que encaja con la venta sin perder trazabilidad en la cuenta del comercio.</p></div>
            <div className="divide-y divide-white/15 border-y border-white/15">
              <article className="grid gap-5 py-8 sm:grid-cols-[auto_1fr]"><KeyRound className="size-7 text-[#85a7ff]" aria-hidden="true" /><div><h3 className="text-2xl font-semibold tracking-[-0.03em]">Código directo</h3><p className="mt-3 max-w-xl leading-7 text-white/65">Solicítalo desde la cuenta y entrégalo al comprador cuando esté disponible.</p></div></article>
              <article className="grid gap-5 py-8 sm:grid-cols-[auto_1fr]"><ScanLine className="size-7 text-[#85a7ff]" aria-hidden="true" /><div><h3 className="text-2xl font-semibold tracking-[-0.03em]">Tarjeta física con QR</h3><p className="mt-3 max-w-xl leading-7 text-white/65">Permanece inactiva en exhibición. El comercio la activa al vender y el comprador consulta su código desde la tarjeta.</p></div></article>
            </div>
          </div>
        </section>

        <section id="control" className="marketing-section">
          <div className="marketing-container grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="marketing-section-heading lg:sticky lg:top-28 lg:self-start"><h2>Control para quien opera el negocio.</h2><p>La cuenta reúne las acciones comerciales y su trazabilidad sin quitarle protagonismo a tu tienda.</p></div>
            <div className="grid gap-px overflow-hidden rounded-2xl border border-[#cbd8d5] bg-[#cbd8d5] sm:grid-cols-2">
              {[
                [Users, "Usuarios y alcances", "Organiza quién administra y quién opera cada local."],
                [BookOpenText, "Historial operativo", "Consulta compras y activaciones realizadas por el equipo."],
                [CircleDollarSign, "Saldo y movimientos", "Revisa consumos, abonos y el balance de la cuenta."],
                [Store, "Operación por local", "Mantén contexto sobre dónde y por quién ocurre cada acción."],
              ].map(([Icon, title, copy]) => (
                <article key={String(title)} className="bg-white p-7 sm:p-9"><Icon aria-hidden="true" className="size-6 text-[#2457d6]" /><h3 className="mt-8 text-xl font-semibold tracking-[-0.03em] text-[#12333a]">{String(title)}</h3><p className="mt-3 text-sm leading-6 text-[#5c7377]">{String(copy)}</p></article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-[#dce5e2] bg-white py-12">
          <div className="marketing-container grid gap-7 md:grid-cols-3">
            {[
              [ShieldCheck, "Activación autorizada", "La tarjeta se activa desde una cuenta con acceso operativo."],
              [Check, "Trazabilidad", "Compras, activaciones y movimientos quedan disponibles para consulta."],
              [Building2, "Relación B2B", "Vercode abastece al comercio; no compite por la venta al consumidor."],
            ].map(([Icon, title, copy]) => (
              <div key={String(title)} className="flex gap-4"><Icon className="mt-1 size-5 shrink-0 text-[#2457d6]" aria-hidden="true" /><div><h3 className="font-semibold text-[#12333a]">{String(title)}</h3><p className="mt-2 text-sm leading-6 text-[#61777a]">{String(copy)}</p></div></div>
            ))}
          </div>
        </section>

        <section id="preguntas" className="marketing-section">
          <div className="marketing-container grid gap-12 lg:grid-cols-[0.7fr_1.3fr]">
            <div className="marketing-section-heading"><h2>Preguntas antes de abrir una cuenta.</h2><p>Respuestas concretas sobre el funcionamiento comercial y operativo.</p></div>
            <div className="divide-y divide-[#cbd8d5] border-y border-[#cbd8d5]">
              {faqs.map(([question, answer]) => (
                <details key={question} className="group py-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-5 font-semibold text-[#12333a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2457d6]">{question}<span aria-hidden="true" className="text-xl text-[#2457d6] group-open:rotate-45">+</span></summary><p className="max-w-2xl pt-4 text-sm leading-7 text-[#5c7377]">{answer}</p></details>
              ))}
            </div>
          </div>
        </section>

        <section id="solicitar-cuenta" className="marketing-section bg-[#e7edf9]">
          <div className="marketing-container grid gap-12 lg:grid-cols-[0.78fr_1.22fr]">
            <div><h2 className="text-3xl font-semibold tracking-[-0.045em] text-[#12333a] sm:text-5xl">Conversemos sobre tu operación.</h2><p className="mt-5 max-w-md leading-7 text-[#526a6e]">Cuéntanos qué tipo de negocio tienes. El equipo revisará la solicitud antes de habilitar una cuenta.</p><Link href="/empresas" className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-[#244aa6] underline-offset-4 hover:underline">¿Buscas regalos o incentivos para una empresa? <ArrowRight className="size-4" /></Link></div>
            <div className="rounded-2xl bg-white p-6 shadow-[0_24px_70px_rgba(18,51,58,0.09)] sm:p-9"><LeadForm /></div>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
