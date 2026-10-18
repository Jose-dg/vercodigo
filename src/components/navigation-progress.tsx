"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

const START_EVENT = "navigation-progress:start";
// Si la ruta nunca cambia (navegación cancelada, mismo destino), la barra no se queda colgada.
const SAFETY_TIMEOUT_MS = 10_000;
const FINISH_HIDE_MS = 450;

type Phase = "idle" | "loading" | "finishing";

/**
 * Inicia la barra desde una navegación programática (`router.push`).
 * Los clicks en `<a>`/`<Link>` la inician solos.
 */
export function startNavigationProgress() {
  window.dispatchEvent(new Event(START_EVENT));
}

function isInternalNavigation(event: MouseEvent): boolean {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return false;
  }
  const anchor = (event.target as Element | null)?.closest?.("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) return false;
  if ((anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return false;

  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return false;
  // Solo cambia el hash o es la misma URL: Next no navega.
  return url.pathname !== window.location.pathname || url.search !== window.location.search;
}

function NavigationProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [phase, setPhase] = React.useState<Phase>("idle");

  React.useEffect(() => {
    const start = () => setPhase("loading");
    const onClick = (event: MouseEvent) => {
      if (isInternalNavigation(event)) start();
    };
    // Captura: un stopPropagation dentro de un menú o fila clicable no debe ocultar la navegación.
    document.addEventListener("click", onClick, true);
    window.addEventListener(START_EVENT, start);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener(START_EVENT, start);
    };
  }, []);

  // La URL cambió: la navegación terminó.
  React.useEffect(() => {
    setPhase((current) => (current === "loading" ? "finishing" : current));
  }, [pathname, searchParams]);

  React.useEffect(() => {
    if (phase === "idle") return;
    const timer = window.setTimeout(
      () => setPhase(phase === "loading" ? "finishing" : "idle"),
      phase === "loading" ? SAFETY_TIMEOUT_MS : FINISH_HIDE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [phase]);

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 origin-left bg-primary",
        phase === "idle" && "scale-x-0 opacity-0",
        // Avanza rápido al principio y frena: se percibe progreso sin conocer la duración real.
        // El retraso de opacidad evita el parpadeo en navegaciones ya cacheadas.
        phase === "loading" &&
          "scale-x-[0.85] opacity-100 [transition:transform_8s_cubic-bezier(0.1,0.7,0.3,1),opacity_150ms_ease_100ms]",
        phase === "finishing" &&
          "scale-x-100 opacity-0 [transition:transform_200ms_ease-out,opacity_250ms_ease_200ms]",
      )}
    />
  );
}

export function NavigationProgress() {
  return (
    <React.Suspense fallback={null}>
      <NavigationProgressBar />
    </React.Suspense>
  );
}
