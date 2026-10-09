"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Phone, Plus } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type StoreOption = { id: string; name: string; isActive: boolean };
type OriginPhone = {
    id: string;
    companyId: string;
    storeId: string | null;
    phone: string;
    label: string;
    isActive: boolean;
    store: { id: string; name: string } | null;
    _count: { users: number; purchases: number };
};

type FormState = { phone: string; label: string; storeId: string };
const emptyForm: FormState = { phone: "", label: "", storeId: "none" };

function formatPhone(phone: string) {
    return phone.replace(/^(\d{3})(\d{3})(\d{4})$/, "$1 $2 $3");
}

async function responseData(response: Response) {
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.message ?? "No se pudo guardar el número de origen");
    return data;
}

export function PurchaseOriginPhonesPanel({
    companyId,
    stores,
    onChange,
}: {
    companyId: string;
    stores: StoreOption[];
    onChange?: () => void | Promise<void>;
}) {
    const [rows, setRows] = useState<OriginPhone[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<OriginPhone | null>(null);
    const [form, setForm] = useState<FormState>(emptyForm);

    const load = useCallback(async () => {
        try {
            const response = await fetch(
                `/api/purchase-origin-phones?companyId=${encodeURIComponent(companyId)}&includeInactive=true`,
            );
            setRows(await responseData(response));
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "No se pudieron cargar los números");
        } finally {
            setLoading(false);
        }
    }, [companyId]);

    useEffect(() => { void load(); }, [load]);

    function openCreate() {
        setEditing(null);
        setForm(emptyForm);
        setDialogOpen(true);
    }

    function openEdit(row: OriginPhone) {
        setEditing(row);
        setForm({
            phone: row.phone,
            label: row.label === row.phone ? "" : row.label,
            storeId: row.storeId ?? "none",
        });
        setDialogOpen(true);
    }

    async function save() {
        setSaving(true);
        try {
            const body = {
                ...(!editing ? { companyId } : {}),
                phone: form.phone,
                label: form.label || null,
                storeId: form.storeId === "none" ? null : form.storeId,
            };
            const response = await fetch(
                editing ? `/api/purchase-origin-phones/${editing.id}` : "/api/purchase-origin-phones",
                {
                    method: editing ? "PATCH" : "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                },
            );
            await responseData(response);
            toast.success(editing ? "Número actualizado" : "Número añadido");
            setDialogOpen(false);
            await load();
            await onChange?.();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "No se pudo guardar el número");
        } finally {
            setSaving(false);
        }
    }

    async function toggleActive(row: OriginPhone) {
        setSaving(true);
        try {
            const response = await fetch(`/api/purchase-origin-phones/${row.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: !row.isActive }),
            });
            await responseData(response);
            toast.success(row.isActive ? "Número desactivado" : "Número reactivado");
            await load();
            await onChange?.();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "No se pudo cambiar el estado");
        } finally {
            setSaving(false);
        }
    }

    return (
        <>
            <Card className="bg-card shadow-sm border-border">
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Phone className="h-5 w-5" aria-hidden="true" />
                            Números de origen de compras
                        </CardTitle>
                        <CardDescription className="mt-1">
                            Identifican quién solicitó una compra. No autorizan activaciones de tarjetas.
                        </CardDescription>
                    </div>
                    <Button type="button" onClick={openCreate}>
                        <Plus aria-hidden="true" />
                        Añadir número
                    </Button>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <p className="text-sm text-muted-foreground">Cargando números…</p>
                    ) : rows.length === 0 ? (
                        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                            Esta compañía todavía no tiene números de origen.
                        </p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Número</TableHead>
                                    <TableHead>Persona o etiqueta</TableHead>
                                    <TableHead>Sede</TableHead>
                                    <TableHead>Uso</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.map((row) => (
                                    <TableRow key={row.id}>
                                        <TableCell className="font-mono">{formatPhone(row.phone)}</TableCell>
                                        <TableCell>{row.label === row.phone ? "Sin nombre" : row.label}</TableCell>
                                        <TableCell>{row.store?.name ?? "—"}</TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {row._count.purchases} compra(s) · {row._count.users} usuario(s)
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={row.isActive ? "default" : "outline"}>
                                                {row.isActive ? "Activo" : "Inactivo"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="icon-sm"
                                                    onClick={() => openEdit(row)}
                                                    aria-label={`Editar ${formatPhone(row.phone)}`}
                                                >
                                                    <Pencil aria-hidden="true" />
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={saving}
                                                    onClick={() => void toggleActive(row)}
                                                >
                                                    {row.isActive ? "Desactivar" : "Reactivar"}
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editing ? "Editar número de origen" : "Añadir número de origen"}</DialogTitle>
                        <DialogDescription>
                            La etiqueta puede cambiarse cuando cambie la persona. Las compras anteriores conservan su etiqueta histórica.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="origin-phone">Número celular</Label>
                            <Input
                                id="origin-phone"
                                inputMode="tel"
                                autoComplete="tel"
                                placeholder="300 370 2892"
                                value={form.phone}
                                onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                            />
                            {editing && editing._count.purchases > 0 && (
                                <p className="text-xs text-muted-foreground">
                                    Este número tiene compras: puedes cambiar la etiqueta, pero no reemplazar el número histórico.
                                </p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="origin-label">Persona o etiqueta (opcional)</Label>
                            <Input
                                id="origin-label"
                                placeholder="Ej. Jhon"
                                value={form.label}
                                onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Sede asociada (opcional)</Label>
                            <Select
                                value={form.storeId}
                                onValueChange={(value) => setForm((current) => ({ ...current, storeId: value }))}
                            >
                                <SelectTrigger aria-label="Sede asociada">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Sin sede</SelectItem>
                                    {stores.filter((store) => store.isActive).map((store) => (
                                        <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                            Cancelar
                        </Button>
                        <Button type="button" disabled={saving || !form.phone.trim()} onClick={() => void save()}>
                            {saving ? "Guardando…" : "Guardar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
