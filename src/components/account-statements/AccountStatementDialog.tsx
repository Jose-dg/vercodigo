"use client";

import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Preview = {
    companyId: string;
    companyName: string;
    currency: string;
    periodStart: string;
    periodEnd: string;
    openingBalance: string;
    consumptions: string;
    recharges: string;
    closingBalance: string;
    totalPending: string;
    creditBalance: string;
    fingerprint: string;
    canIssue: boolean;
    blockers: string[];
    lines: Array<{
        id: string;
        occurredAt: string;
        description: string;
        quantity: number | null;
        debit: string;
        credit: string;
        balanceAfter: string;
    }>;
};

function localDateTimeValue() {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
}

function money(value: string | number, currency: string, absolute = false) {
    const amount = Number(value);
    return new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
    }).format(absolute ? Math.abs(amount) : amount);
}

export function AccountStatementDialog({ companyId, companyName }: { companyId: string; companyName: string }) {
    const [open, setOpen] = useState(false);
    const [cutoffAt, setCutoffAt] = useState(localDateTimeValue);
    const [preview, setPreview] = useState<Preview | null>(null);
    const [loading, setLoading] = useState(false);
    const [issuing, setIssuing] = useState(false);

    const loadPreview = async () => {
        setLoading(true);
        setPreview(null);
        try {
            const isoCutoff = new Date(cutoffAt).toISOString();
            const response = await fetch(`/api/account-statements/preview?companyId=${encodeURIComponent(companyId)}&cutoffAt=${encodeURIComponent(isoCutoff)}`);
            const data = await response.json();
            if (!response.ok) throw new Error(data.message ?? "No se pudo preparar el corte");
            setPreview(data.preview);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "No se pudo preparar el corte");
        } finally {
            setLoading(false);
        }
    };

    const issue = async () => {
        if (!preview) return;
        setIssuing(true);
        try {
            const response = await fetch("/api/account-statements", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    companyId,
                    cutoffAt: preview.periodEnd,
                    fingerprint: preview.fingerprint,
                }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message ?? "No se pudo emitir el estado");
            toast.success(`${data.statement.statementNumber} emitido`);
            setOpen(false);
            setPreview(null);
            window.open(`/api/account-statements/${data.statement.id}/pdf`, "_blank", "noopener,noreferrer");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "No se pudo emitir el estado");
        } finally {
            setIssuing(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setPreview(null); }}>
            <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                    <FileText /> Generar estado de cuenta
                </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Estado de cuenta de {companyName}</DialogTitle>
                    <DialogDescription>
                        Revisa el corte antes de emitirlo. Una vez emitido, el documento queda inmutable.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                    <div className="space-y-1.5">
                        <Label htmlFor={`cutoff-${companyId}`}>Fecha y hora de corte</Label>
                        <Input
                            id={`cutoff-${companyId}`}
                            type="datetime-local"
                            value={cutoffAt}
                            max={localDateTimeValue()}
                            onChange={(event) => { setCutoffAt(event.target.value); setPreview(null); }}
                        />
                    </div>
                    <Button onClick={loadPreview} disabled={loading || !cutoffAt}>
                        {loading ? <Loader2 className="animate-spin" /> : null}
                        {loading ? "Preparando…" : "Previsualizar"}
                    </Button>
                </div>

                {preview ? (
                    <div className="space-y-5">
                        <div className="border-y border-border bg-muted/50 px-4 py-4">
                            <div className="grid gap-4 sm:grid-cols-4">
                                <div>
                                    <p className="text-xs text-muted-foreground">Saldo anterior</p>
                                    <p className="mt-1 font-semibold tabular-nums">{money(preview.openingBalance, preview.currency, true)}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Consumos</p>
                                    <p className="mt-1 font-semibold tabular-nums">{money(preview.consumptions, preview.currency, true)}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Abonos</p>
                                    <p className="mt-1 font-semibold tabular-nums">{money(preview.recharges, preview.currency, true)}</p>
                                </div>
                                <div className="border-l-2 border-[#123f68] pl-4">
                                    <p className="text-xs text-muted-foreground">
                                        {Number(preview.closingBalance) < 0 ? "Total pendiente" : Number(preview.closingBalance) > 0 ? "Saldo a favor" : "Saldo al día"}
                                    </p>
                                    <p className="mt-1 text-lg font-bold tabular-nums text-[#123f68]">
                                        {money(Number(preview.closingBalance) < 0 ? preview.totalPending : preview.creditBalance, preview.currency)}
                                    </p>
                                </div>
                            </div>
                            <p className="mt-3 text-xs text-muted-foreground">
                                {new Date(preview.periodStart).toLocaleString("es-CO")} – {new Date(preview.periodEnd).toLocaleString("es-CO")} · {preview.lines.length} movimientos
                            </p>
                        </div>

                        {preview.blockers.length > 0 ? (
                            <div role="alert" className="border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                                <p className="font-semibold">Antes de emitir</p>
                                <ul className="mt-1 list-disc space-y-1 pl-5">
                                    {preview.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
                                </ul>
                            </div>
                        ) : null}

                        <div className="max-h-72 overflow-auto border">
                            <Table>
                                <TableHeader className="sticky top-0 bg-background">
                                    <TableRow>
                                        <TableHead>Fecha</TableHead>
                                        <TableHead>Descripción</TableHead>
                                        <TableHead className="text-right">Cant.</TableHead>
                                        <TableHead className="text-right">Débito</TableHead>
                                        <TableHead className="text-right">Crédito</TableHead>
                                        <TableHead className="text-right">Balance</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {preview.lines.map((line) => (
                                        <TableRow key={line.id}>
                                            <TableCell className="whitespace-nowrap text-xs">{new Date(line.occurredAt).toLocaleString("es-CO")}</TableCell>
                                            <TableCell>{line.description}</TableCell>
                                            <TableCell className="text-right">{line.quantity ?? "—"}</TableCell>
                                            <TableCell className="text-right tabular-nums">{Number(line.debit) ? money(line.debit, preview.currency) : "—"}</TableCell>
                                            <TableCell className="text-right tabular-nums">{Number(line.credit) ? money(line.credit, preview.currency) : "—"}</TableCell>
                                            <TableCell className="text-right tabular-nums">{money(line.balanceAfter, preview.currency)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                ) : null}

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cerrar</Button>
                    <Button onClick={issue} disabled={!preview?.canIssue || issuing}>
                        {issuing ? <Loader2 className="animate-spin" /> : <FileText />}
                        {issuing ? "Emitiendo…" : "Emitir estado de cuenta"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
