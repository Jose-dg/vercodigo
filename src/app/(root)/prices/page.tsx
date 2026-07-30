"use client";

import { useCallback, useEffect, useState } from "react";
import { useAbility } from "@/components/auth/ability-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface PriceRow {
    productId: string;
    productName: string;
    brand: string;
    denominationId: string | null;
    wholesaleAmount: number | null;
    wholesaleCurrency: string | null;
    priceId: string | null;
    salePrice: number | null;
    currency: string | null;
}

interface CompanyOption {
    companyId: string;
    companyName: string;
}

function rowKey(r: PriceRow) {
    return `${r.productId}:${r.denominationId ?? "base"}`;
}

export default function PricesPage() {
    const ability = useAbility();
    const canEdit = ability.can("update", "CompanyProductPrice");
    const isPlatform = ability.can("manage", "Wallet"); // solo plataforma gestiona wallets

    const [rows, setRows] = useState<PriceRow[]>([]);
    const [companies, setCompanies] = useState<CompanyOption[]>([]);
    const [companyId, setCompanyId] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [drafts, setDrafts] = useState<Record<string, string>>({});
    const [savingKey, setSavingKey] = useState<string | null>(null);

    const fetchCatalog = useCallback(async (cId?: string) => {
        setLoading(true);
        try {
            const qs = cId ? `?companyId=${cId}` : "";
            const res = await fetch(`/api/prices${qs}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Error cargando precios");
            setRows(data.rows ?? []);
            const nextDrafts: Record<string, string> = {};
            (data.rows ?? []).forEach((r: PriceRow) => {
                nextDrafts[rowKey(r)] = r.salePrice != null ? String(r.salePrice) : "";
            });
            setDrafts(nextDrafts);
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!ability.can("read", "CompanyProductPrice")) return;
        if (isPlatform) {
            // Plataforma: cargar compañías desde el resumen de wallets y esperar selección
            fetch("/api/wallets")
                .then((r) => r.json())
                .then((d) => setCompanies((d.wallets ?? []).map((w: any) => ({ companyId: w.companyId, companyName: w.companyName }))))
                .catch(() => toast.error("Error cargando compañías"))
                .finally(() => setLoading(false));
        } else {
            fetchCatalog();
        }
    }, [ability, isPlatform, fetchCatalog]);

    useEffect(() => {
        if (isPlatform && companyId) fetchCatalog(companyId);
    }, [isPlatform, companyId, fetchCatalog]);

    const savePrice = async (row: PriceRow) => {
        const key = rowKey(row);
        const salePrice = parseFloat(drafts[key]);
        if (!(salePrice > 0)) {
            toast.error("Precio inválido");
            return;
        }
        setSavingKey(key);
        try {
            const res = await fetch("/api/prices", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    companyId: isPlatform ? companyId : undefined,
                    productId: row.productId,
                    denominationId: row.denominationId,
                    salePrice,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Error guardando precio");
            toast.success("Precio guardado");
            fetchCatalog(isPlatform ? companyId : undefined);
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setSavingKey(null);
        }
    };

    const removePrice = async (row: PriceRow) => {
        if (!row.priceId) return;
        setSavingKey(rowKey(row));
        try {
            const res = await fetch(`/api/prices/${row.priceId}`, { method: "DELETE" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Error eliminando precio");
            toast.success("Precio eliminado");
            fetchCatalog(isPlatform ? companyId : undefined);
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setSavingKey(null);
        }
    };

    if (!ability.can("read", "CompanyProductPrice")) {
        return <div className="p-8">No tienes permisos para ver esta página.</div>;
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">Precios de Venta</h1>
                {isPlatform && (
                    <Select value={companyId} onValueChange={setCompanyId}>
                        <SelectTrigger className="w-64">
                            <SelectValue placeholder="Seleccionar compañía..." />
                        </SelectTrigger>
                        <SelectContent>
                            {companies.map((c) => (
                                <SelectItem key={c.companyId} value={c.companyId}>
                                    {c.companyName}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Catálogo</CardTitle>
                    <CardDescription>
                        Precio al que tu empresa vende cada producto al cliente final. El costo mayorista
                        (denominación) es lo que se descuenta de tu wallet — la diferencia es tu margen.
                        {!canEdit && " (Solo lectura para tu rol.)"}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isPlatform && !companyId ? (
                        <div className="text-center text-muted-foreground py-12">
                            Selecciona una compañía para ver/editar sus precios.
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Producto</TableHead>
                                    <TableHead>Denominación (costo)</TableHead>
                                    <TableHead className="w-56">Precio de venta</TableHead>
                                    {canEdit && <TableHead className="text-right">Acciones</TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={canEdit ? 4 : 3} className="text-center h-24">
                                            Cargando...
                                        </TableCell>
                                    </TableRow>
                                ) : rows.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={canEdit ? 4 : 3} className="text-center h-24">
                                            Sin productos activos.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    rows.map((row) => {
                                        const key = rowKey(row);
                                        return (
                                            <TableRow key={key}>
                                                <TableCell className="font-medium">
                                                    {row.productName}
                                                    <span className="text-muted-foreground ml-2 text-xs">{row.brand}</span>
                                                </TableCell>
                                                <TableCell className="font-mono">
                                                    {row.wholesaleAmount != null
                                                        ? `${row.wholesaleAmount} ${row.wholesaleCurrency}`
                                                        : "—"}
                                                </TableCell>
                                                <TableCell>
                                                    {canEdit ? (
                                                        <div className="flex items-center gap-2">
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                step="0.01"
                                                                className="font-mono w-36"
                                                                value={drafts[key] ?? ""}
                                                                placeholder="Sin precio"
                                                                onChange={(e) =>
                                                                    setDrafts((d) => ({ ...d, [key]: e.target.value }))
                                                                }
                                                            />
                                                            <span className="text-xs text-muted-foreground">
                                                                {row.currency ?? "COP"}
                                                            </span>
                                                        </div>
                                                    ) : row.salePrice != null ? (
                                                        <span className="font-mono">
                                                            {row.salePrice} {row.currency}
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-foreground">Sin configurar</span>
                                                    )}
                                                </TableCell>
                                                {canEdit && (
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-1">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                title="Guardar"
                                                                disabled={savingKey === key}
                                                                onClick={() => savePrice(row)}
                                                            >
                                                                <Save className="h-4 w-4" />
                                                            </Button>
                                                            {row.priceId && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    title="Eliminar precio"
                                                                    disabled={savingKey === key}
                                                                    onClick={() => removePrice(row)}
                                                                >
                                                                    <Trash2 className="h-4 w-4 text-red-500" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                )}
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
