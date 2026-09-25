"use client";

import { useState } from "react";
import { Check, Copy, LockKeyhole, ScanLine, Store } from "lucide-react";

const stages = [
  {
    title: "Tarjeta inactiva",
    copy: "El código permanece oculto hasta que el comercio confirma la venta.",
    action: "Simular activación",
  },
  {
    title: "Activada por la tienda",
    copy: "Un operador autorizado completó la activación desde su cuenta.",
    action: "Ver código de ejemplo",
  },
  {
    title: "Código disponible",
    copy: "El comprador puede consultarlo desde la tarjeta.",
    action: "Reiniciar demostración",
  },
] as const;

export function CardDemo() {
  const [stage, setStage] = useState(0);
  const [copied, setCopied] = useState(false);
  const current = stages[stage];

  const advance = () => {
    setCopied(false);
    setStage((value) => (value + 1) % stages.length);
  };

  const copyExample = async () => {
    await navigator.clipboard.writeText("VCDE-EJEMPLO-2026");
    setCopied(true);
  };

  return (
    <div className="marketing-demo" aria-label="Demostración de una tarjeta Vercode">
      <div className="marketing-card-shell">
        <div className="flex items-center justify-between gap-4 border-b border-white/15 pb-5">
          <span className="text-lg font-semibold tracking-[-0.03em]">Vercode</span>
          <span className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/70">
            Demostración
          </span>
        </div>

        <div className="flex min-h-[250px] flex-col justify-between py-7">
          <div>
            <div className="mb-6 flex size-12 items-center justify-center rounded-full bg-white/10">
              {stage === 0 ? (
                <LockKeyhole aria-hidden="true" />
              ) : stage === 1 ? (
                <Store aria-hidden="true" />
              ) : (
                <ScanLine aria-hidden="true" />
              )}
            </div>
            <p className="text-sm text-white/60">Estado de la tarjeta</p>
            <p className="mt-1 text-2xl font-semibold tracking-[-0.035em]">{current.title}</p>
            <p className="mt-3 max-w-sm text-sm leading-6 text-white/70">{current.copy}</p>
          </div>

          {stage === 2 && (
            <div className="mt-7 rounded-xl border border-dashed border-white/35 bg-white/10 p-4">
              <p className="text-xs text-white/55">Código de demostración · no canjeable</p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <code className="text-sm font-semibold tracking-[0.08em] sm:text-base">
                  VCDE-EJEMPLO-2026
                </code>
                <button
                  type="button"
                  className="rounded-lg p-2 text-white/75 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  onClick={copyExample}
                  aria-label="Copiar código de demostración"
                >
                  {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                </button>
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={advance}
          className="w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#12333a] transition-colors hover:bg-[#e7edf9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          {current.action}
        </button>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2" aria-label={`Paso ${stage + 1} de 3`}>
        {stages.map((item, index) => (
          <button
            key={item.title}
            type="button"
            onClick={() => setStage(index)}
            className="group text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2457d6]"
            aria-current={stage === index ? "step" : undefined}
          >
            <span
              className={`block h-1 rounded-full ${stage === index ? "bg-[#2457d6]" : "bg-[#cad5d2]"}`}
            />
            <span className="mt-2 block text-xs text-[#526a6e]">{index + 1}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
