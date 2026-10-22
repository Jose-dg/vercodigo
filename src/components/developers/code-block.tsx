'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';

export type CodeSample = { label: string; code: string };

/** Code samples with language tabs and copy. No highlighter: plain, readable mono. */
export function CodeBlock({ samples, className }: { samples: CodeSample[]; className?: string }) {
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
        <div className={cn('my-4 overflow-hidden rounded-xl border bg-zinc-950 text-zinc-100', className)}>
            <div className="flex items-center justify-between border-b border-zinc-800 px-2">
                <div className="flex">
                    {samples.map((sample, index) => (
                        <button
                            key={sample.label}
                            type="button"
                            onClick={() => setActive(index)}
                            className={cn(
                                'px-3 py-2 text-xs font-medium transition-colors',
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
                    className="flex items-center gap-1.5 px-2 py-1 text-xs text-zinc-400 hover:text-white"
                    aria-label="Copiar código"
                >
                    {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    {copied ? 'Copiado' : 'Copiar'}
                </button>
            </div>
            <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed">
                <code>{current.code}</code>
            </pre>
        </div>
    );
}
