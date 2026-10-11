"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AlertCircle, FileText, Loader2, Paperclip, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { compressReceipt } from "@/lib/wallet/receipt-upload";
import {
    EVIDENCE_ACCEPT,
    EVIDENCE_MAX_FILES,
    acceptSelection,
    evidenceFileError,
    formatBytes,
} from "@/lib/wallet/topup-evidence";

export type Receipt = { id: string; file: File; previewUrl: string | null };

/** Selected receipts, compressed on arrival; preview URLs are revoked when dropped. */
export function useReceipts(existingCount = 0) {
    const [receipts, setReceipts] = useState<Receipt[]>([]);
    const [preparing, setPreparing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const receiptsRef = useRef(receipts);
    useEffect(() => {
        receiptsRef.current = receipts;
    }, [receipts]);
    useEffect(() => () => receiptsRef.current.forEach((receipt) => revoke(receipt)), []);

    const add = useCallback(async (selected: File[]) => {
        const selection = acceptSelection(existingCount + receiptsRef.current.length, selected);
        const problems: string[] = selection.error ? [selection.error] : [];
        setPreparing(true);
        try {
            const prepared: Receipt[] = [];
            for (const original of selected.slice(0, selection.accepted)) {
                const file = await compressReceipt(original);
                const problem = evidenceFileError(file);
                if (problem) {
                    problems.push(problem);
                    continue;
                }
                prepared.push({
                    id: crypto.randomUUID(),
                    file,
                    previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
                });
            }
            setReceipts((current) => [...current, ...prepared]);
        } finally {
            setPreparing(false);
            setError(problems.length ? problems.join(" ") : null);
        }
    }, [existingCount]);

    const remove = useCallback((id: string) => {
        setReceipts((current) => {
            const dropped = current.find((receipt) => receipt.id === id);
            if (dropped) revoke(dropped);
            return current.filter((receipt) => receipt.id !== id);
        });
        setError(null);
    }, []);

    /** Drops the given files (already uploaded), or all of them. */
    const drop = useCallback((files?: File[]) => {
        setReceipts((current) => {
            const gone = files ? current.filter((receipt) => files.includes(receipt.file)) : current;
            gone.forEach((receipt) => revoke(receipt));
            return current.filter((receipt) => !gone.includes(receipt));
        });
        setError(null);
    }, []);

    return { receipts, preparing, error, setError, add, remove, drop, existingCount };
}

function revoke(receipt: Receipt) {
    if (receipt.previewUrl) URL.revokeObjectURL(receipt.previewUrl);
}

export type ReceiptsState = ReturnType<typeof useReceipts>;

function Thumbnail({ receipt, onRemove, disabled }: { receipt: Receipt; onRemove: () => void; disabled: boolean }) {
    // HEIC previews only render in Safari: elsewhere show the file card instead.
    const [broken, setBroken] = useState(false);
    const showImage = receipt.previewUrl && !broken;
    return (
        <li className="relative overflow-hidden rounded-lg border bg-muted/30">
            {showImage ? (
                // eslint-disable-next-line @next/next/no-img-element -- local blob preview, not an optimizable asset
                <img
                    src={receipt.previewUrl!}
                    alt={`Vista previa de ${receipt.file.name}`}
                    className="aspect-square w-full object-cover"
                    onError={() => setBroken(true)}
                />
            ) : (
                <div className="flex aspect-square w-full flex-col items-center justify-center gap-1 p-2 text-center">
                    <FileText className="size-7 text-muted-foreground" aria-hidden="true" />
                    <span className="line-clamp-2 break-all text-[11px] text-muted-foreground">{receipt.file.name}</span>
                </div>
            )}
            <span className="absolute bottom-1 left-1 rounded bg-background/90 px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
                {formatBytes(receipt.file.size)}
            </span>
            <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute right-1 top-1 size-9 rounded-full bg-background/90 shadow-sm"
                onClick={onRemove}
                disabled={disabled}
                aria-label={`Quitar ${receipt.file.name}`}
            >
                <X className="size-4" aria-hidden="true" />
            </Button>
        </li>
    );
}

/**
 * "Adjuntar comprobante": on phones the file input offers the camera or the
 * gallery. Shows thumbnails, sizes, limits and upload progress.
 */
export function ReceiptPicker({ state, disabled = false, progress = null, optional = true }: {
    state: ReceiptsState;
    disabled?: boolean;
    /** 0..1 while uploading. */
    progress?: number | null;
    optional?: boolean;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const helpId = useId();
    const total = state.existingCount + state.receipts.length;
    const full = total >= EVIDENCE_MAX_FILES;
    const busy = disabled || state.preparing || progress !== null;

    return (
        <div className="space-y-3">
            <input
                ref={inputRef}
                type="file"
                accept={EVIDENCE_ACCEPT}
                multiple
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    event.target.value = ""; // the same photo can be picked again after removing it
                    if (files.length) void state.add(files);
                }}
            />
            {!full ? (
                <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    disabled={busy}
                    aria-describedby={helpId}
                    className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-dashed bg-background px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-60"
                >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        {state.preparing ? (
                            <Loader2 className="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                        ) : (
                            <Paperclip className="size-5" aria-hidden="true" />
                        )}
                    </span>
                    <span className="min-w-0">
                        <span className="block text-sm font-medium">
                            {state.preparing
                                ? "Preparando foto…"
                                : total > 0
                                    ? "Adjuntar otro comprobante"
                                    : "Adjuntar comprobante"}
                        </span>
                        <span id={helpId} className="block text-xs text-muted-foreground">
                            Foto o PDF de la transferencia{optional ? " · opcional" : ""} · hasta {EVIDENCE_MAX_FILES}
                        </span>
                    </span>
                </button>
            ) : null}

            {state.receipts.length > 0 ? (
                <ul className="grid grid-cols-3 gap-2" aria-label="Comprobantes seleccionados">
                    {state.receipts.map((receipt) => (
                        <Thumbnail
                            key={receipt.id}
                            receipt={receipt}
                            onRemove={() => state.remove(receipt.id)}
                            disabled={busy}
                        />
                    ))}
                </ul>
            ) : null}

            {progress !== null ? (
                <div className="space-y-1" aria-live="polite">
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Subiendo comprobante…</span>
                        <span className="tabular-nums">{Math.round(progress * 100)}%</span>
                    </div>
                    <div
                        role="progressbar"
                        aria-label="Subida del comprobante"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(progress * 100)}
                        className="h-2 overflow-hidden rounded-full bg-muted"
                    >
                        <div className="h-full bg-primary transition-[width] motion-reduce:transition-none" style={{ width: `${progress * 100}%` }} />
                    </div>
                </div>
            ) : null}

            {state.error ? (
                <p role="alert" className="flex items-start gap-2 text-xs text-destructive">
                    <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /> {state.error}
                </p>
            ) : null}
        </div>
    );
}
