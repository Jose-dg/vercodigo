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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { AlertCircle, Check, Copy, Loader2, RefreshCw } from "lucide-react";
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

function PurchaseTable({
    rows,
    emptyMessage,
    showCodes = false,
}: {
    rows: PurchaseHistoryItem[];
    emptyMessage: string;
    showCodes?: boolean;
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
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={!purchase.keys.length}
                                    onClick={() => copyCodes(purchase)}
                                >
                                    <Copy className="mr-2 h-3 w-3" />
                                    Copiar
                                </Button>
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
