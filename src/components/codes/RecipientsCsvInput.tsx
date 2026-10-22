'use client';

import { useRef } from 'react';
import { Download, FileUp, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
    MAX_CSV_RECIPIENTS,
    RECIPIENTS_CSV_TEMPLATE,
    parseRecipientsCsv,
    type ParsedRecipientsCsv,
} from '@/lib/codes/recipients-csv';

export type RecipientsCsv = { fileName: string; text: string; parsed: ParsedRecipientsCsv };

const PREVIEW_ROWS = 8;

function downloadText(fileName: string, text: string) {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
}

export function downloadCsv(fileName: string, text: string) {
    // BOM so Excel opens accents correctly.
    downloadText(fileName, `﻿${text}`);
}

/** File picker + validation preview for "Varios (CSV)". */
export function RecipientsCsvInput({
    value,
    onChange,
}: {
    value: RecipientsCsv | null;
    onChange: (value: RecipientsCsv | null) => void;
}) {
    const inputRef = useRef<HTMLInputElement>(null);

    const load = async (file: File | undefined) => {
        if (!file) return;
        const text = await file.text();
        onChange({ fileName: file.name, text, parsed: parseRecipientsCsv(text) });
        if (inputRef.current) inputRef.current.value = '';
    };

    if (!value) {
        return (
            <div className="space-y-3">
                <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground transition-colors hover:bg-muted/40"
                >
                    <FileUp className="size-5" aria-hidden="true" />
                    <span>
                        Sube un CSV con <strong className="text-foreground">nombre, apellido, email</strong> (hasta{' '}
                        {MAX_CSV_RECIPIENTS} personas, un código para cada una)
                    </span>
                </button>
                <input
                    ref={inputRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(event) => void load(event.target.files?.[0])}
                />
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    onClick={() => downloadCsv('plantilla-destinatarios.csv', RECIPIENTS_CSV_TEMPLATE)}
                >
                    <Download className="mr-1.5 size-3.5" aria-hidden="true" />
                    Descargar plantilla
                </Button>
            </div>
        );
    }

    const { rows, errors } = value.parsed;
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                <span className="min-w-0 truncate">
                    <strong>{value.fileName}</strong> · {rows.length} destinatario(s)
                    {errors.length ? <span className="text-destructive"> · {errors.length} con error</span> : null}
                </span>
                <Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => onChange(null)} aria-label="Quitar archivo">
                    <X className="size-4" />
                </Button>
            </div>
            {errors.length > 0 && (
                <ul className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                    {errors.map((error) => (
                        <li key={`${error.line}-${error.message}`}>
                            Fila {error.line}: {error.message}
                        </li>
                    ))}
                </ul>
            )}
            {rows.length > 0 && (
                <div className="overflow-hidden rounded-lg border text-xs">
                    <table className="w-full">
                        <tbody className="divide-y">
                            {rows.slice(0, PREVIEW_ROWS).map((row) => (
                                <tr key={row.line}>
                                    <td className="w-10 px-2 py-1.5 text-muted-foreground">{row.line}</td>
                                    <td className="px-2 py-1.5">
                                        {row.recipient.firstName} {row.recipient.lastName}
                                    </td>
                                    <td className="truncate px-2 py-1.5 text-muted-foreground">{row.recipient.email}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {rows.length > PREVIEW_ROWS && (
                        <p className="border-t px-2 py-1.5 text-muted-foreground">y {rows.length - PREVIEW_ROWS} más…</p>
                    )}
                </div>
            )}
            {errors.length > 0 && <p className="text-xs text-muted-foreground">Corrige el archivo y vuelve a subirlo.</p>}
        </div>
    );
}
