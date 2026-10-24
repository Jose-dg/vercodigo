'use client';

import { CheckCircle2, CircleAlert, Clock, Download, Loader2, RotateCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { recipientsResultCsv } from '@/lib/codes/recipients-csv';
import { downloadCsv } from './RecipientsCsvInput';
import type { BatchRowState } from './recipients-batch';

const STATUS_ICON = {
    queued: <Clock className="size-4 text-muted-foreground" aria-label="En cola" />,
    sending: <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Enviando" />,
    ok: <CheckCircle2 className="size-4 text-emerald-600" aria-label="Listo" />,
    error: <CircleAlert className="size-4 text-destructive" aria-label="Error" />,
};

/** Progress and outcome of a "Varios (CSV)" send. */
export function RecipientsBatchDialog({
    rows,
    running,
    onRetryFailed,
    onShowHistory,
    onClose,
}: {
    rows: BatchRowState[] | null;
    running: boolean;
    onRetryFailed: () => void;
    onShowHistory: () => void;
    onClose: () => void;
}) {
    const done = rows?.filter((row) => row.status === 'ok').length ?? 0;
    const failed = rows?.filter((row) => row.status === 'error').length ?? 0;
    const total = rows?.length ?? 0;

    return (
        <Dialog open={rows !== null} onOpenChange={(open) => !open && !running && onClose()}>
            <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto overscroll-contain p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-6" onInteractOutside={(event) => running && event.preventDefault()}>
                <DialogHeader>
                    <DialogTitle>{running ? 'Enviando a tus destinatarios…' : 'Envío terminado'}</DialogTitle>
                    <DialogDescription>
                        {done} de {total} listo(s){failed ? ` · ${failed} con error` : ''}.{' '}
                        {running
                            ? 'No cierres esta ventana. Si se corta, vuelve a subir el mismo archivo: no se cobra dos veces.'
                            : 'La billetera se debita a medida que cada entrega se completa.'}
                    </DialogDescription>
                </DialogHeader>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                        className="h-full bg-primary transition-[width]"
                        style={{ width: `${total ? ((done + failed) / total) * 100 : 0}%` }}
                    />
                </div>
                <ul className="max-h-72 divide-y overflow-y-auto rounded-lg border text-sm">
                    {rows?.map((row) => (
                        <li key={row.line} className="flex items-center gap-3 px-3 py-2">
                            {STATUS_ICON[row.status]}
                            <span className="min-w-0 flex-1">
                                <span className="block truncate">{row.recipient.email}</span>
                                {row.message && (
                                    <span className={row.status === 'error' ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
                                        {row.message}
                                    </span>
                                )}
                            </span>
                            <span className="text-xs text-muted-foreground">fila {row.line}</span>
                        </li>
                    ))}
                </ul>
                <DialogFooter className="gap-2 sm:justify-between">
                    <Button
                        variant="outline"
                        disabled={running || !rows}
                        onClick={() => rows && downloadCsv('resultado-envio.csv', recipientsResultCsv(rows))}
                    >
                        <Download className="mr-2 size-4" />
                        Descargar resultado
                    </Button>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        {failed > 0 && !running && (
                            <Button variant="outline" onClick={onRetryFailed}>
                                <RotateCw className="mr-2 size-4" />
                                Reintentar fallidos
                            </Button>
                        )}
                        <Button disabled={running} onClick={onShowHistory}>
                            Ver mis solicitudes
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
