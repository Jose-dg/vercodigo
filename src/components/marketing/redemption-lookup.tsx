"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

export function RedemptionLookup() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = value.trim().toUpperCase().replace(/\s+/g, "");
    if (!/^[2-9A-HJ-NP-Z]{8}$/.test(normalized)) {
      setError("Revisa el identificador impreso en la tarjeta.");
      return;
    }
    router.push(`/scan/${encodeURIComponent(normalized)}`);
  };

  return (
    <form onSubmit={submit} className="mt-5" noValidate>
      <label htmlFor="card-id" className="text-sm font-medium text-[#12333a]">
        ¿Recibiste una tarjeta?
      </label>
      <p className="mt-1 text-sm text-[#526a6e]">Ingresa el identificador impreso junto al QR.</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          id="card-id"
          name="card-id"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setError("");
          }}
          autoComplete="off"
          spellCheck={false}
          inputMode="text"
          placeholder="Ej. 2AB4C6DE"
          aria-describedby={error ? "card-id-error" : "card-id-help"}
          aria-invalid={Boolean(error)}
          className="h-12 min-w-0 flex-1 rounded-xl border border-[#b9c8c5] bg-white px-4 font-medium uppercase tracking-[0.08em] text-[#12333a] outline-none transition focus:border-[#2457d6] focus:ring-4 focus:ring-[#2457d6]/10"
        />
        <button
          type="submit"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[#12333a] px-5 text-sm font-semibold text-[#12333a] transition-colors hover:bg-[#12333a] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2457d6]"
        >
          Consultar tarjeta
          <ArrowRight aria-hidden="true" className="size-4" />
        </button>
      </div>
      <p id="card-id-help" className="sr-only">
        El identificador tiene ocho caracteres y no incluye cero, O, uno, I ni L.
      </p>
      {error && (
        <p id="card-id-error" role="alert" className="mt-2 text-sm text-[#a33a2d]">
          {error}
        </p>
      )}
    </form>
  );
}
