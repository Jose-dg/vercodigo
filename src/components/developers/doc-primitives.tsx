import type { ReactNode } from 'react';
import { Info, TriangleAlert } from 'lucide-react';

import { cn } from '@/lib/utils';

/** Public base URL shown in every example. */
export function apiBaseUrl(): string {
    return (process.env.NEXT_PUBLIC_APP_URL || 'https://vercode.me').replace(/\/$/, '');
}

export function DocPage({ title, lead, children }: { title: string; lead?: ReactNode; children: ReactNode }) {
    return (
        <article className="mx-auto w-full max-w-3xl">
            <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
            {lead && <p className="mt-3 text-base leading-relaxed text-muted-foreground">{lead}</p>}
            <div className="mt-8 space-y-4 text-sm leading-relaxed [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h3]:mt-6 [&_h3]:font-semibold">
                {children}
            </div>
        </article>
    );
}

const METHOD_STYLE: Record<string, string> = {
    GET: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
    POST: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    DELETE: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

export function Endpoint({ method, path, scope }: { method: 'GET' | 'POST' | 'DELETE'; path: string; scope?: string }) {
    return (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/40 px-4 py-3 font-mono text-sm">
            <span className={cn('rounded-md px-2 py-0.5 text-xs font-bold', METHOD_STYLE[method])}>{method}</span>
            <span className="break-all">{path}</span>
            {scope && <span className="ml-auto rounded-md border px-2 py-0.5 text-xs text-muted-foreground">{scope}</span>}
        </div>
    );
}

export type Param = { name: string; type: string; required?: boolean; description: ReactNode };

export function ParamTable({ params }: { params: Param[] }) {
    return (
        <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>
                        <th className="px-4 py-2 font-medium">Campo</th>
                        <th className="px-4 py-2 font-medium">Tipo</th>
                        <th className="px-4 py-2 font-medium">Descripción</th>
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {params.map((param) => (
                        <tr key={param.name} className="align-top">
                            <td className="px-4 py-3 font-mono text-xs">
                                {param.name}
                                {param.required && <span className="ml-1 text-destructive">*</span>}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{param.type}</td>
                            <td className="px-4 py-3">{param.description}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export function Callout({ tone = 'info', children }: { tone?: 'info' | 'warning'; children: ReactNode }) {
    const Icon = tone === 'warning' ? TriangleAlert : Info;
    return (
        <div
            className={cn(
                'flex gap-3 rounded-xl border px-4 py-3',
                tone === 'warning'
                    ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200'
                    : 'bg-muted/40',
            )}
        >
            <Icon className="mt-0.5 size-4 shrink-0" />
            <div>{children}</div>
        </div>
    );
}

export function InlineCode({ children }: { children: ReactNode }) {
    return <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[13px]">{children}</code>;
}
