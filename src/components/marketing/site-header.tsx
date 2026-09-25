import Link from "next/link";
import { LogIn } from "lucide-react";

import { marketingConfig } from "@/lib/marketing/config";

export function MarketingHeader() {
  return (
    <header className="marketing-header sticky top-0 z-50 border-b border-[#dce5e2] bg-[#f2f5f2]/95">
      <div className="marketing-container flex min-h-[68px] items-center justify-between gap-6">
        <Link
          href="/"
          className="text-xl font-bold tracking-[-0.05em] text-[#12333a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2457d6]"
        >
          Vercode
        </Link>

        <nav aria-label="Navegación principal" className="hidden items-center gap-7 lg:flex">
          <Link className="marketing-nav-link" href="/#como-funciona">Cómo funciona</Link>
          <Link className="marketing-nav-link" href="/#tarjetas">Tarjetas con QR</Link>
          <Link className="marketing-nav-link" href="/#control">Control</Link>
          <Link className="marketing-nav-link" href="/empresas">Empresas</Link>
          <Link className="marketing-nav-link" href="/#preguntas">Preguntas</Link>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href={marketingConfig.urls.login}
            className="hidden h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-[#12333a] hover:bg-white sm:inline-flex"
          >
            <LogIn aria-hidden="true" className="size-4" />
            Iniciar sesión
          </Link>
          <Link
            href="/#solicitar-cuenta"
            className="inline-flex h-10 items-center rounded-lg bg-[#2457d6] px-4 text-sm font-semibold text-white hover:bg-[#1d46ad] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2457d6]"
          >
            Solicitar cuenta
          </Link>
        </div>
      </div>
    </header>
  );
}
