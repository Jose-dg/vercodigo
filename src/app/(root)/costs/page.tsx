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

const GLOBAL = "__global__";

interface CostRow {
    productId: string;
    productName: string;
    brand: string;
    denominationId: string | null;
    nominalAmount: number | null;
    nominalCurrency: string | null;
    globalCostId: string | null;
    globalCost: number | null;
    globalCurrency: string | null;
    companyCostId: string | null;
    companyCost: number | null;
    companyCurrency: string | null;
}

interface CompanyOption {
    companyId: string;
    companyName: string;
}

function rowKey(r: CostRow) {
    return `${r.productId}:${r.denominationId ?? "base"}`;
}

export default function CostsPage() {
    const ability = useAbility();
    const canManage = ability.can("manage", "ProductCost");

    const [rows, setRows] = useState<CostRow[]>([]);
    const [companies, setCompanies] = useState<CompanyOption[]>([]);
    const [scope, setScope] = useState<string>(GLOBAL);
    const [walletCurrency, setWalletCurrency] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [drafts, setDrafts] = useState<Record<string, string>>({});
    const [savingKey, setSavingKey] = useState<string | null>(null);

    const isGlobal = scope === GLOBAL;

    const fetchCatalog = useCallback(async (currentScope: string) => {
        setLoading(true);
        try {
            const qs = currentScope === GLOBAL ? "" : `?companyId=${currentScope}`;
            const res = await fetch(`/api/costs${qs}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Error cargando costos");
            setRows(data.rows ?? []);
            setWalletCurrency(data.walletCurrency ?? null);
            const nextDrafts: Record<string, string> = {};
            (data.rows ?? []).forEach((r: CostRow) => {
                const value = currentScope === GLOBAL ? r.globalCost : r.companyCost;
                nextDrafts[rowKey(r)] = value != null ? String(value) : "";
            });
            setDrafts(nextDrafts);
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!canManage) return;
        fetch("/api/wallets")
            .then((r) => r.json())
            .then((d) => setCompanies((d.wallets ?? []).map((w: any) => ({ companyId: w.companyId, companyName: w.companyName }))))
            .catch(() => { });
        fetchCatalog(scope);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canManage]);

    useEffect(() => {
        if (canManage) fetchCatalog(scope);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scope]);

    const saveCost = async (row: CostRow) => {
        const key = rowKey(row);
        const cost = parseFloat(drafts[key]);
        if (!(cost > 0)) {
            toast.error("Costo inválido");
            return;
        }
        setSavingKey(key);
        try {
            const res = await fetch("/api/costs", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    companyId: isGlobal ? null : scope,
                    productId: row.productId,
                    denominationId: row.denominationId,
                    cost,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Error guardando costo");
            toast.success("Costo guardado");
            fetchCatalog(scope);
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setSavingKey(null);
        }
    };

    const removeCost = async (row: CostRow) => {
        const costId = isGlobal ? row.globalCostId : row.companyCostId;
        if (!costId) return;
        setSavingKey(rowKey(row));
        try {
            const res = await fetch(`/api/costs/${costId}`, { method: "DELETE" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Error eliminando costo");
            toast.success("Costo eliminado");
            fetchCatalog(scope);
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setSavingKey(null);
        }
    };

    if (!canManage) {
        return <div className="p-8">No tienes permisos para ver esta página.</div>;
    }

    const editCurrency = isGlobal ? "COP" : walletCurrency ?? "COP";

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">Costos de Productos</h1>
                <Select value={scope} onValueChange={setScope}>
                    <SelectTrigger className="w-72">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={GLOBAL}>Costo global (default para todas)</SelectItem>
                        {companies.map((c) => (
                            <SelectItem key={c.companyId} value={c.companyId}>
                                Override: {c.companyName}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{isGlobal ? "Costo global" : "Tarifa negociada"}</CardTitle>
                    <CardDescription>
                        Lo que se debita de la wallet de {isGlobal ? "las compañías (salvo tarifa negociada)" : "esta compañía"} por
                        cada producto. Sin costo configurado se debita el valor nominal de la denominación.
                        {!isGlobal && walletCurrency && ` Moneda de su wallet: ${walletCurrency}.`}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Producto</TableHead>
                                <TableHead>Denominación (nominal)</TableHead>
                                {!isGlobal && <TableHead>Costo global</TableHead>}
                                <TableHead className="w-64">{isGlobal ? "Costo global" : "Tarifa de la compañía"}</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={isGlobal ? 4 : 5} className="text-center h-24">Cargando...</TableCell>
                                </TableRow>
                            ) : rows.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={isGlobal ? 4 : 5} className="text-center h-24">Sin productos activos.</TableCell>
                                </TableRow>
                            ) : (
                                rows.map((row) => {
                                    const key = rowKey(row);
                                    const existingId = isGlobal ? row.globalCostId : row.companyCostId;
                                    return (
                                        <TableRow key={key}>
                                            <TableCell className="font-medium">
                                                {row.productName}
                                                <span className="text-muted-foreground ml-2 text-xs">{row.brand}</span>
                                            </TableCell>
                                            <TableCell className="font-mono">
                                                {row.nominalAmount != null ? `${row.nominalAmount} ${row.nominalCurrency}` : "—"}
                                            </TableCell>
                                            {!isGlobal && (
                                                <TableCell className="font-mono text-muted-foreground">
                                                    {row.globalCost != null ? `${row.globalCost} ${row.globalCurrency}` : "—"}
                                                </TableCell>
                                            )}
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        className="font-mono w-36"
                                                        value={drafts[key] ?? ""}
                                                        placeholder="Sin costo"
                                                        onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
                                                    />
                                                    <span className="text-xs text-muted-foreground">{editCurrency}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        title="Guardar"
                                                        disabled={savingKey === key}
                                                        onClick={() => saveCost(row)}
                                                    >
                                                        <Save className="h-4 w-4" />
                                                    </Button>
                                                    {existingId && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            title="Eliminar costo"
                                                            disabled={savingKey === key}
                                                            onClick={() => removeCost(row)}
                                                        >
                                                            <Trash2 className="h-4 w-4 text-red-500" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
