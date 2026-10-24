'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';

export type CodeSample = { label: string; code: string };

/** Code samples with language tabs and copy. No highlighter: plain, readable mono. */
export function CodeBlock({
    samples,
    className,
    copyLabel = 'Copiar',
}: {
    samples: CodeSample[];
    className?: string;
    copyLabel?: string;
}) {
    const [active, setActive] = useState(0);
    const [copied, setCopied] = useState(false);
    const current = samples[Math.min(active, samples.length - 1)];

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(current.code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            toast.error('No se pudo copiar');
        }
    };

    return (
        <div className={cn('my-4 min-w-0 max-w-full overflow-hidden rounded-xl border bg-zinc-950 text-zinc-100', className)}>
            <div className="flex min-w-0 items-center justify-between border-b border-zinc-800 px-1 sm:px-2">
                <div className="flex min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Lenguaje del ejemplo">
                    {samples.map((sample, index) => (
                        <button
                            key={sample.label}
                            type="button"
                            role="tab"
                            aria-selected={index === active}
                            onClick={() => setActive(index)}
                            className={cn(
                                'min-h-11 shrink-0 px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-400',
                                index === active ? 'text-white' : 'text-zinc-400 hover:text-zinc-200',
                            )}
                        >
                            {sample.label}
                        </button>
                    ))}
                </div>
                <button
                    type="button"
                    onClick={copy}
                    className="flex min-h-11 shrink-0 items-center gap-1.5 px-3 py-1 text-xs text-zinc-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-400"
                    aria-label={copied ? 'Copiado' : copyLabel}
                >
                    {copied ? <Check aria-hidden="true" className="size-3.5" /> : <Copy aria-hidden="true" className="size-3.5" />}
                    <span className="hidden sm:inline">{copied ? 'Copiado' : copyLabel}</span>
                    <span className="sr-only" aria-live="polite">{copied ? 'Copiado al portapapeles' : ''}</span>
                </button>
            </div>
            <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed">
                <code>{current.code}</code>
            </pre>
        </div>
    );
}
