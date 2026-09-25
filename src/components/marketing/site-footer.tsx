import Link from "next/link";

import { hasConfiguredLegalIdentity, marketingConfig } from "@/lib/marketing/config";

export function MarketingFooter() {
  return (
    <footer className="border-t border-[#dce5e2] bg-white py-10">
      <div className="marketing-container grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <Link href="/" className="text-xl font-bold tracking-[-0.05em] text-[#12333a]">
            Vercode
          </Link>
          <p className="mt-3 max-w-md text-sm leading-6 text-[#526a6e]">
            Infraestructura para que comercios y empresas gestionen códigos digitales y tarjetas con QR.
          </p>
          {hasConfiguredLegalIdentity && (
            <p className="mt-4 text-xs leading-5 text-[#6c8082]">
              {marketingConfig.company.legalName} · {marketingConfig.company.taxId}<br />
              {marketingConfig.company.address}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-3 text-sm text-[#526a6e]">
          <Link href="/empresas" className="hover:text-[#12333a]">Empresas</Link>
          <Link href="/login" className="hover:text-[#12333a]">Iniciar sesión</Link>
          {marketingConfig.contact.linkedinUrl && (
            <a href={marketingConfig.contact.linkedinUrl} rel="noreferrer" target="_blank" className="hover:text-[#12333a]">
              LinkedIn
            </a>
          )}
        </div>
      </div>
      <div className="marketing-container mt-8 border-t border-[#e6ecea] pt-5 text-xs leading-5 text-[#6c8082]">
        Las marcas mencionadas pertenecen a sus respectivos titulares. Vercode no afirma afiliación ni patrocinio salvo autorización expresa.
      </div>
    </footer>
  );
}
