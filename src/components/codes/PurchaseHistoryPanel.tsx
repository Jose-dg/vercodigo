"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { AlertCircle, Check, ChevronRight, Copy, Eye, Loader2, QrCode, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface PurchaseHistoryItem {
    kind?: "purchase" | "activation";
    id: string;
    detailHref?: string;
    cardUuid?: string | null;
    count: number;
    totalAmount: number;
    currency: string;
    status: string;
    fulfillmentStatus?: string | null;
    lastError?: string | null;
    createdAt: string;
    occurredAt?: string;
    completedAt?: string | null;
    productName?: string;
    requesterLabel?: string;
    isPending: boolean;
    isSuccessful: boolean;
    needsAction: boolean;
    keys: { code: string }[];
    deliveredCodeCount: number;
    hasDeliveryCountMismatch: boolean;
    denomination?: { amount: number; currency: string } | null;
    deliveryRecipient?: { firstName: string; lastName: string; email: string } | null;
    recipientDelivery?: "sending" | "sent" | "failed" | null;
}

const RECIPIENT_DELIVERY_TEXT = { sending: "enviando", sent: "enviado", failed: "no se pudo enviar" } as const;

interface PurchaseHistoryPanelProps {
    refreshToken?: number;
}

function statusLabel(purchase: PurchaseHistoryItem): string {
    switch (purchase.status) {
        case "PENDING":
            return purchase.lastError ? "Pendiente · error Diem" : "Pendiente en Diem";
        case "PROCESSING":
            return "Procesando en Diem";
        case "AWAITING_STOCK":
            return "Esperando stock";
        case "FINALIZING":
            return "Finalizando";
        case "ACTION_REQUIRED":
            return "Acción requerida";
        case "COMPLETED":
            return "Entregada";
        case "FAILED":
            return "Fallida";
        case "REVERSED":
            return "Anulada · reembolsada";
        default:
            return purchase.status;
    }
}

function statusVariant(purchase: PurchaseHistoryItem): "default" | "secondary" | "destructive" | "outline" {
    if (purchase.isSuccessful) return "default";
    if (purchase.needsAction || purchase.status === "FAILED" || purchase.status === "REVERSED") return "destructive";
    if (purchase.isPending) return "secondary";
    return "outline";
}

function formatWhen(value: string | null | undefined) {
    if (!value) return "—";
    return new Intl.DateTimeFormat("es-CO", {
        dateStyle: "short",
        timeStyle: "short",
    }).format(new Date(value));
}

/**
 * El operador copia los códigos para enviárselos al cliente: solo se confirma si el
 * portapapeles los aceptó (iOS o permisos denegados hacen fallar writeText).
 */
async function copyCodesToClipboard(purchase: PurchaseHistoryItem): Promise<boolean> {
    const text = purchase.keys.map((row) => row.code).join("\n");
    try {
        await navigator.clipboard.writeText(text);
        toast.success(purchase.keys.length === 1 ? "Código copiado" : `${purchase.keys.length} códigos copiados`);
        return true;
    } catch {
        toast.error("No se pudo copiar. Abre «Ver» y selecciona los códigos manualmente.");
        return false;
    }
}

/** Botón de copiar con confirmación visible en el propio botón durante 1,5 s. */
function CopyCodesButton({ purchase, label = "Copiar", className }: { purchase: PurchaseHistoryItem; label?: string; className?: string }) {
    const [copied, setCopied] = useState(false);
    useEffect(() => {
        if (!copied) return;
        const timer = window.setTimeout(() => setCopied(false), 1500);
        return () => window.clearTimeout(timer);
    }, [copied]);

    return (
        <Button
            variant="outline"
            size="sm"
            className={className}
            disabled={!purchase.keys.length}
            onClick={async () => setCopied(await copyCodesToClipboard(purchase))}
        >
            {copied ? (
                <Check className="mr-2 h-3 w-3 text-emerald-600" aria-hidden="true" />
            ) : (
                <Copy className="mr-2 h-3 w-3" aria-hidden="true" />
            )}
            {copied ? "Copiado" : label}
        </Button>
    );
}

function ViewCodesDialog({
    purchase,
    open,
    onOpenChange,
}: {
    purchase: PurchaseHistoryItem | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    if (!purchase) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto overscroll-contain p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-6">
                <DialogHeader>
                    <DialogTitle>Códigos entregados</DialogTitle>
                    <DialogDescription>
                        {purchase.productName ?? "Producto"} · {purchase.count} unidad(es)
                        {purchase.denomination
                            ? ` · ${purchase.denomination.amount} ${purchase.denomination.currency}`
                            : ""}
                    </DialogDescription>
                </DialogHeader>
                {purchase.keys.length ? (
                    <div className="rounded-md border bg-muted/40 p-4 font-mono text-sm max-h-60 overflow-y-auto">
                        <ul className="space-y-2">
                            {purchase.keys.map((row, index) => (
                                <li key={`${row.code}-${index}`} className="flex gap-3">
                                    <span className="text-muted-foreground w-6 shrink-0">{index + 1}.</span>
                                    <span className="font-semibold break-all select-all">{row.code}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">
                        No hay códigos registrados para esta entrega. Pulsa Actualizar o contacta soporte.
                    </p>
                )}
                <DialogFooter className="gap-2 sm:justify-between">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cerrar
                    </Button>
                    <CopyCodesButton purchase={purchase} label="Copiar todos" className="h-9 px-4" />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function PurchaseTable({
    rows,
    emptyMessage,
    showCodes = false,
    onViewCodes,
    onRetry,
    retryingId,
}: {
    rows: PurchaseHistoryItem[];
    emptyMessage: string;
    showCodes?: boolean;
    onViewCodes?: (purchase: PurchaseHistoryItem) => void;
    onRetry?: (purchase: PurchaseHistoryItem) => void;
    retryingId?: string | null;
}) {
    if (!rows.length) {
        return (
            <p className="text-sm text-muted-foreground py-6 text-center">{emptyMessage}</p>
        );
    }

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead className="hidden sm:table-cell">Fecha</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Cant.</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="hidden md:table-cell">Solicitó</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {rows.map((purchase) => (
                    <TableRow key={purchase.id}>
                        <TableCell className="hidden whitespace-nowrap text-sm sm:table-cell">
                            {formatWhen(purchase.occurredAt ?? purchase.completedAt ?? purchase.createdAt)}
                        </TableCell>
                        <TableCell>
                            <div className="font-medium">{purchase.productName ?? "Producto"}</div>
                            {/* En celular la fecha va bajo el producto (la columna se oculta). */}
                            <div className="text-xs text-muted-foreground sm:hidden">
                                {formatWhen(purchase.occurredAt ?? purchase.completedAt ?? purchase.createdAt)}
                            </div>
                            {purchase.deliveryRecipient && (
                                <div
                                    className={cn(
                                        "text-xs",
                                        purchase.recipientDelivery === "failed" ? "text-destructive" : "text-muted-foreground",
                                    )}
                                >
                                    Para {purchase.deliveryRecipient.email}
                                    {purchase.recipientDelivery ? ` · ${RECIPIENT_DELIVERY_TEXT[purchase.recipientDelivery]}` : ""}
                                </div>
                            )}
                            {purchase.kind === "activation" && (
                                <Badge variant="outline" className="mt-1 gap-1 font-normal">
                                    <QrCode className="h-3 w-3" />
                                    Activación QR{purchase.cardUuid ? ` · ${purchase.cardUuid}` : ""}
                                </Badge>
                            )}
                            {purchase.denomination && (
                                <div className="text-xs text-muted-foreground">
                                    {purchase.denomination.amount} {purchase.denomination.currency}
                                </div>
                            )}
                            {purchase.lastError && (purchase.isPending || purchase.needsAction || purchase.status === "REVERSED") && (
                                <div className="text-xs text-amber-700 mt-1">{purchase.lastError}</div>
                            )}
                        </TableCell>
                        <TableCell>
                            <span>{purchase.count}</span>
                            {purchase.hasDeliveryCountMismatch && (
                                <span className="mt-1 block text-xs leading-tight text-amber-700">
                                    {purchase.count} unidad{purchase.count === 1 ? "" : "es"} facturada{purchase.count === 1 ? "" : "s"}
                                    {" · "}{purchase.deliveredCodeCount} códigos registrados
                                </span>
                            )}
                        </TableCell>
                        <TableCell>
                            <Badge variant={statusVariant(purchase)}>{statusLabel(purchase)}</Badge>
                        </TableCell>
                        <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                            {purchase.requesterLabel ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">
                                <div className="flex flex-col items-end gap-2">
                                    {showCodes && purchase.keys.length > 0 && (
                                        <div className="font-mono text-xs text-left w-full max-w-[220px] space-y-1">
                                            {purchase.keys.slice(0, 2).map((row, index) => (
                                                <div
                                                    key={`${purchase.id}-${row.code}-${index}`}
                                                    className="rounded border bg-muted/30 px-2 py-1 break-all select-all"
                                                >
                                                    {row.code}
                                                </div>
                                            ))}
                                            {purchase.keys.length > 2 && (
                                                <p className="text-muted-foreground text-[11px]">
                                                    +{purchase.keys.length - 2} más
                                                </p>
                                            )}
                                        </div>
                                    )}
                                    <div className="flex flex-wrap justify-end gap-2">
                                        <Button variant="outline" size="sm" asChild>
                                            <Link href={purchase.detailHref ?? `/codes/purchases/${purchase.id}`}>
                                                Detalle
                                                <ChevronRight className="ml-1 h-3 w-3" />
                                            </Link>
                                        </Button>
                                        {(purchase.isPending || purchase.needsAction) && onRetry ? (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled={retryingId === purchase.id}
                                                onClick={() => onRetry(purchase)}
                                            >
                                                {retryingId === purchase.id ? (
                                                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                                ) : (
                                                    <RefreshCw className="mr-2 h-3 w-3" />
                                                )}
                                                {purchase.needsAction ? "Reintentar Diem" : "Consultar Diem"}
                                            </Button>
                                        ) : null}
                                        {showCodes ? (
                                          <>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={!purchase.keys.length}
                                            onClick={() => onViewCodes?.(purchase)}
                                        >
                                            <Eye className="mr-2 h-3 w-3" />
                                            Ver
                                        </Button>
                                        <CopyCodesButton purchase={purchase} />
                                          </>
                                        ) : null}
                                    </div>
                                </div>
                            </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}

export function PurchaseHistoryPanel({ refreshToken = 0 }: PurchaseHistoryPanelProps) {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [pending, setPending] = useState<PurchaseHistoryItem[]>([]);
    const [completed, setCompleted] = useState<PurchaseHistoryItem[]>([]);
    const [failed, setFailed] = useState<PurchaseHistoryItem[]>([]);
    const [viewingPurchase, setViewingPurchase] = useState<PurchaseHistoryItem | null>(null);
    const [retryingId, setRetryingId] = useState<string | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const requestSequenceRef = useRef(0);
    const hasLoadedRef = useRef(false);
    const [hasLoaded, setHasLoaded] = useState(false);

    /**
     * mode "initial": skeleton; "refresh": botón Actualizar; "poll": silencioso.
     * Un poll fallido no muestra toast (con mala señal serían toasts cada 5 s) y
     * solo la respuesta más reciente escribe el estado.
     */
    const loadHistory = useCallback(async (mode: "initial" | "refresh" | "poll" = "initial") => {
        const requestId = ++requestSequenceRef.current;
        if (mode === "refresh") setRefreshing(true);
        if (mode === "initial") setLoading(true);
        try {
            const response = await fetch("/api/codes/purchases", { cache: "no-store" });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data.message || "No se pudo cargar el historial");
            }
            if (requestId !== requestSequenceRef.current) return;
            setPending(data.pending ?? []);
            setCompleted(data.completed ?? []);
            setFailed(data.failed ?? []);
            setLoadError(null);
            hasLoadedRef.current = true;
            setHasLoaded(true);
        } catch (error) {
            if (requestId !== requestSequenceRef.current) return;
            const message = error instanceof Error ? error.message : "Error cargando historial";
            setLoadError(message);
            if (mode !== "poll") toast.error(message);
        } finally {
            if (requestId === requestSequenceRef.current) {
                setLoading(false);
                setRefreshing(false);
            }
        }
    }, []);

    const retryPurchase = useCallback(async (purchase: PurchaseHistoryItem) => {
        setRetryingId(purchase.id);
        try {
            const endpoint = purchase.kind === "activation" && purchase.cardUuid
                ? `/api/codes/activations/${encodeURIComponent(purchase.cardUuid)}`
                : `/api/codes/purchases/${purchase.id}`;
            const response = await fetch(endpoint, {
                method: "POST",
                cache: "no-store",
            });
            const data = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(data?.message || "No se pudo consultar la entrega en Diem");
            }
            toast.success(
                (data?.purchase?.status ?? data?.status) === "COMPLETED"
                    ? "Entrega completada"
                    : "Estado actualizado desde Diem",
            );
            await loadHistory("refresh");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "No se pudo consultar Diem");
        } finally {
            setRetryingId(null);
        }
    }, [loadHistory]);

    useEffect(() => {
        // Tras la primera carga, un refreshToken nuevo actualiza sin volver al skeleton.
        void loadHistory(hasLoadedRef.current ? "poll" : "initial");
    }, [loadHistory, refreshToken]);

    useEffect(() => {
        if (!pending.length) return;
        // Sin pestaña visible no se consulta; al volver se actualiza de inmediato.
        const timer = window.setInterval(() => {
            if (document.visibilityState === "visible") void loadHistory("poll");
        }, 5000);
        const onVisibilityChange = () => {
            if (document.visibilityState === "visible") void loadHistory("poll");
        };
        document.addEventListener("visibilitychange", onVisibilityChange);
        return () => {
            window.clearInterval(timer);
            document.removeEventListener("visibilitychange", onVisibilityChange);
        };
    }, [pending.length, loadHistory]);

    if (loading) {
        return (
            <div role="status" aria-live="polite" className="space-y-6">
                <span className="sr-only">Cargando solicitudes…</span>
                <div className="flex items-center justify-between gap-3">
                    <div className="space-y-2">
                        <Skeleton className="h-6 w-40" />
                        <Skeleton className="h-4 w-80 max-w-full" />
                    </div>
                    <Skeleton className="h-8 w-28" />
                </div>
                <Skeleton className="h-40 rounded-xl" />
                <Skeleton className="h-56 rounded-xl" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <ViewCodesDialog
                purchase={viewingPurchase}
                open={Boolean(viewingPurchase)}
                onOpenChange={(open) => {
                    if (!open) setViewingPurchase(null);
                }}
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <h2 className="text-xl font-semibold">Mis solicitudes</h2>
                    <p className="text-sm text-muted-foreground">
                        Compras de códigos y activaciones de tarjetas QR. Las solicitudes quedan registradas aunque cierres esta pantalla. Si Diem ya resolvió stock o aprobación, consulta nuevamente su estado.
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    className="h-11 w-full shrink-0 sm:w-auto"
                    onClick={() => loadHistory("refresh")}
                    disabled={refreshing}
                >
                    {refreshing ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    Actualizar
                </Button>
            </div>

            {loadError && (
                <div className="flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 sm:flex-row sm:items-center sm:justify-between">
                    <span className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                        {hasLoaded
                            ? "No se pudo actualizar. Mostramos la última información disponible."
                            : loadError}
                    </span>
                    <Button variant="outline" size="sm" onClick={() => loadHistory("refresh")} disabled={refreshing}>
                        Reintentar
                    </Button>
                </div>
            )}

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Loader2 className={`h-4 w-4 ${pending.length ? "animate-spin text-blue-600" : "text-muted-foreground"}`} />
                        Pendientes por entregar
                    </CardTitle>
                    <CardDescription>
                        {pending.length
                            ? `${pending.length} solicitud(es) esperando asignación de Diem.`
                            : "No hay entregas pendientes en este momento."}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <PurchaseTable
                        rows={pending}
                        emptyMessage="Sin solicitudes pendientes."
                        onRetry={retryPurchase}
                        retryingId={retryingId}
                    />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-600" />
                        Entregadas
                    </CardTitle>
                    <CardDescription>
                        Códigos ya asignados y wallet debitada al completarse.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <PurchaseTable
                        rows={completed}
                        emptyMessage="Aún no hay entregas completadas."
                        showCodes
                        onViewCodes={setViewingPurchase}
                    />
                </CardContent>
            </Card>

            {failed.length > 0 && (
                <Card className="border-red-200">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-red-700">
                            <AlertCircle className="h-4 w-4" />
                            Requieren atención
                        </CardTitle>
                        <CardDescription>
                            Estas solicitudes requieren una revisión o consulta explícita.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <PurchaseTable
                            rows={failed}
                            emptyMessage=""
                            onRetry={retryPurchase}
                            retryingId={retryingId}
                        />
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
