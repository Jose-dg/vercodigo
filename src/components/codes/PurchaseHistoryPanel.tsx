"use client";

import { useCallback, useEffect, useState } from "react";
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
import { AlertCircle, Check, Copy, Eye, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export interface PurchaseHistoryItem {
    id: string;
    count: number;
    totalAmount: number;
    currency: string;
    status: string;
    fulfillmentStatus?: string | null;
    lastError?: string | null;
    createdAt: string;
    completedAt?: string | null;
    productName?: string;
    requesterLabel?: string;
    isPending: boolean;
    isSuccessful: boolean;
    needsAction: boolean;
    keys: { code: string }[];
    denomination?: { amount: number; currency: string } | null;
}

interface PurchaseHistoryPanelProps {
    refreshToken?: number;
}

function statusLabel(purchase: PurchaseHistoryItem): string {
    switch (purchase.status) {
        case "PENDING":
            return "En cola";
        case "AWAITING_STOCK":
            return "Esperando stock";
        case "FINALIZING":
            return "Finalizando";
        case "ACTION_REQUIRED":
            return "Revisión manual";
        case "COMPLETED":
            return "Entregada";
        case "FAILED":
            return "Fallida";
        default:
            return purchase.status;
    }
}

function statusVariant(purchase: PurchaseHistoryItem): "default" | "secondary" | "destructive" | "outline" {
    if (purchase.isSuccessful) return "default";
    if (purchase.needsAction || purchase.status === "FAILED") return "destructive";
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

    const copyCodes = () => {
        const text = purchase.keys.map((row) => row.code).join("\n");
        navigator.clipboard.writeText(text);
        toast.success("Códigos copiados");
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
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
                    <Button onClick={copyCodes} disabled={!purchase.keys.length}>
                        <Copy className="mr-2 h-4 w-4" />
                        Copiar todos
                    </Button>
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
}: {
    rows: PurchaseHistoryItem[];
    emptyMessage: string;
    showCodes?: boolean;
    onViewCodes?: (purchase: PurchaseHistoryItem) => void;
}) {
    if (!rows.length) {
        return (
            <p className="text-sm text-muted-foreground py-6 text-center">{emptyMessage}</p>
        );
    }

    const copyCodes = (purchase: PurchaseHistoryItem) => {
        const text = purchase.keys.map((row) => row.code).join("\n");
        navigator.clipboard.writeText(text);
        toast.success("Códigos copiados");
    };

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Cant.</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Solicitó</TableHead>
                    {showCodes && <TableHead className="text-right">Códigos</TableHead>}
                </TableRow>
            </TableHeader>
            <TableBody>
                {rows.map((purchase) => (
                    <TableRow key={purchase.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                            {formatWhen(purchase.completedAt ?? purchase.createdAt)}
                        </TableCell>
                        <TableCell>
                            <div className="font-medium">{purchase.productName ?? "Producto"}</div>
                            {purchase.denomination && (
                                <div className="text-xs text-muted-foreground">
                                    {purchase.denomination.amount} {purchase.denomination.currency}
                                </div>
                            )}
                            {purchase.lastError && purchase.isPending && (
                                <div className="text-xs text-amber-700 mt-1">{purchase.lastError}</div>
                            )}
                        </TableCell>
                        <TableCell>{purchase.count}</TableCell>
                        <TableCell>
                            <Badge variant={statusVariant(purchase)}>{statusLabel(purchase)}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                            {purchase.requesterLabel ?? "—"}
                        </TableCell>
                        {showCodes && (
                            <TableCell className="text-right">
                                <div className="flex flex-col items-end gap-2">
                                    {purchase.keys.length > 0 && (
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
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={!purchase.keys.length}
                                            onClick={() => onViewCodes?.(purchase)}
                                        >
                                            <Eye className="mr-2 h-3 w-3" />
                                            Ver
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={!purchase.keys.length}
                                            onClick={() => copyCodes(purchase)}
                                        >
                                            <Copy className="mr-2 h-3 w-3" />
                                            Copiar
                                        </Button>
                                    </div>
                                </div>
                            </TableCell>
                        )}
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

    const loadHistory = useCallback(async (refresh = false) => {
        if (refresh) setRefreshing(true);
        else setLoading(true);
        try {
            const params = refresh ? "?refresh=1" : "";
            const response = await fetch(`/api/codes/purchases${params}`, { cache: "no-store" });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || "No se pudo cargar el historial");
            }
            setPending(data.pending ?? []);
            setCompleted(data.completed ?? []);
            setFailed(data.failed ?? []);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Error cargando historial");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadHistory();
    }, [loadHistory, refreshToken]);

    useEffect(() => {
        if (!pending.length) return;
        const timer = window.setInterval(() => loadHistory(true), 5000);
        return () => window.clearInterval(timer);
    }, [pending.length, loadHistory]);

    if (loading) {
        return (
            <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
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
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl font-semibold">Mis solicitudes</h2>
                    <p className="text-sm text-muted-foreground">
                        Las compras pendientes siguen en cola aunque cierres esta pantalla. No necesitas volver a pedirlas.
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadHistory(true)}
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
                            Estas solicitudes no completaron la entrega automática.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <PurchaseTable
                            rows={failed}
                            emptyMessage=""
                        />
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
