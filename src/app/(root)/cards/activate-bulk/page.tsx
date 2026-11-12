"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Loader2, Search, Zap } from "lucide-react";
import { toast } from "sonner";

import { useAbility, useCurrentUser } from "@/components/auth/ability-context";
import { canRunCardBulkOperation } from "@/lib/auth/abilities";
import { BULK_ACTIVATION_CHUNK_SIZE, BULK_ACTIVATION_MAX_CARDS } from "@/lib/cards/bulk-activation";
import { CARD_UUID_LENGTH, parseCardCodes } from "@/lib/cards/card-uuid";
import { formatMoney } from "@/lib/wallet/balance";
import { Badge } from "@/components/ui/badge";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
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
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const CHUNK_SIZE = BULK_ACTIVATION_CHUNK_SIZE;

interface PreviewCard {
    uuid: string;
    product: string;
    store: string;
    company: string;
    billingAmount: number | null;
    billingCurrency: string | null;
    appliedExchangeRate: number | null;
    canActivate: boolean;
    blockReason: string | null;
}

interface CompanySummary {
    companyId: string;
    company: string;
    count: number;
    totals: Array<{ currency: string; amount: number }>;
    wallet: { currency: string; balance: number; balanceAfter: number | null };
}

interface PreviewResponse {
    requested: number;
    missing: string[];
    cards: PreviewCard[];
    eligibleCount: number;
    blockedCount: number;
    companies: CompanySummary[];
}

interface ActivationResult {
    uuid: string;
    outcome: "COMPLETED" | "PROCESSING" | "SKIPPED" | "FAILED";
    status: string | null;
    jobId: string | null;
    message: string | null;
}

const OUTCOME_LABEL: Record<ActivationResult["outcome"], string> = {
    COMPLETED: "Activada",
    PROCESSING: "En proceso",
    SKIPPED: "Omitida",
    FAILED: "Falló",
};

function outcomeVariant(outcome: ActivationResult["outcome"]) {
    if (outcome === "COMPLETED") return "default" as const;
    if (outcome === "FAILED") return "destructive" as const;
    return "secondary" as const;
}

function csvCell(value: string | null | undefined) {
    const text = value ?? "";
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadResultsCsv(results: ActivationResult[], cards: Map<string, PreviewCard>) {
    const header = ["uuid", "producto", "empresa", "sede", "valor", "moneda", "resultado", "estado", "job", "detalle"];
    const lines = results.map((row) => {
        const card = cards.get(row.uuid);
        return [
            row.uuid,
            card?.product,
            card?.company,
            card?.store,
            card?.billingAmount != null ? String(card.billingAmount) : "",
            card?.billingCurrency,
            OUTCOME_LABEL[row.outcome],
            row.status,
            row.jobId,
            row.message,
        ].map(csvCell).join(",");
    });
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `activacion-bloque-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

export default function BulkActivationPage() {
    const currentUser = useCurrentUser();
    const ability = useAbility();
    const allowed = canRunCardBulkOperation("activate", currentUser?.role, ability);

    const [uuidInput, setUuidInput] = useState("");
    const [preview, setPreview] = useState<PreviewResponse | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [running, setRunning] = useState(false);
    const [progress, setProgress] = useState({ done: 0, total: 0 });
    const [results, setResults] = useState<ActivationResult[]>([]);

    const eligible = useMemo(() => preview?.cards.filter((card) => card.canActivate) ?? [], [preview]);
    const blocked = useMemo(() => preview?.cards.filter((card) => !card.canActivate) ?? [], [preview]);
    const cardByUuid = useMemo(
        () => new Map((preview?.cards ?? []).map((card) => [card.uuid, card])),
        [preview],
    );
    const counts = useMemo(() => {
        const acc = { COMPLETED: 0, PROCESSING: 0, SKIPPED: 0, FAILED: 0 };
        results.forEach((row) => { acc[row.outcome] += 1; });
        return acc;
    }, [results]);

    const parsed = useMemo(() => parseCardCodes(uuidInput), [uuidInput]);
    const overLimit = parsed.codes.length > BULK_ACTIVATION_MAX_CARDS;
    const inputReady = parsed.codes.length > 0 && !parsed.invalid.length && !overLimit;

    // Editing the list invalidates the last validation: what gets activated is
    // always exactly what was validated and shown.
    const handleInputChange = (value: string) => {
        setUuidInput(value);
        setPreview(null);
    };

    const removeInvalid = () => handleInputChange(parsed.codes.join("\n"));

    const handlePreview = async () => {
        if (!inputReady) return;
        const values = parsed.codes;
        setPreviewLoading(true);
        setResults([]);
        try {
            const res = await fetch("/api/cards/activate-bulk/preview", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ uuids: values }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "No se pudieron validar las tarjetas");
            setPreview(data as PreviewResponse);
            if (data.missing.length) toast.warning(`${data.missing.length} UUID no encontrados`);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Error validando tarjetas");
        } finally {
            setPreviewLoading(false);
        }
    };

    const handleActivate = async () => {
        setConfirmOpen(false);
        setRunning(true);
        setResults([]);
        setProgress({ done: 0, total: eligible.length });
        const collected: ActivationResult[] = [];
        try {
            for (let i = 0; i < eligible.length; i += CHUNK_SIZE) {
                const chunk = eligible.slice(i, i + CHUNK_SIZE);
                const res = await fetch("/api/cards/activate-bulk", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        // The shown price travels with each card: if it changed since
                        // validation, the server refuses that card instead of billing more.
                        items: chunk.map((card) => (
                            card.billingAmount != null && card.billingCurrency
                                ? {
                                    uuid: card.uuid,
                                    quotedAmount: card.billingAmount,
                                    quotedCurrency: card.billingCurrency,
                                    quotedRate: card.appliedExchangeRate,
                                }
                                : { uuid: card.uuid }
                        )),
                    }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                    throw new Error(
                        `${data.message || "La tanda falló"}. Se detuvo en ${i} de ${eligible.length}; `
                        + "vuelve a validar para continuar con las pendientes.",
                    );
                }
                collected.push(...(data.results as ActivationResult[]));
                setResults([...collected]);
                setProgress({ done: Math.min(i + CHUNK_SIZE, eligible.length), total: eligible.length });
            }
            const failed = collected.filter((row) => row.outcome === "FAILED").length;
            if (failed) toast.warning(`Terminó con ${failed} tarjeta(s) fallidas`);
            else toast.success("Activación en bloque terminada");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Error activando tarjetas");
        } finally {
            setRunning(false);
        }
    };

    if (!allowed) {
        return (
            <div className="p-8">
                <p>No tienes permisos para activar tarjetas en bloque.</p>
                <p className="mt-2 text-sm text-muted-foreground">
                    Esta operación está reservada a SUPER_ADMIN.
                </p>
            </div>
        );
    }

    return (
        <>
            <header className="flex h-16 shrink-0 items-center gap-2">
                <div className="flex items-center gap-2 px-4">
                    <SidebarTrigger className="-ml-1" />
                    <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
                    <Breadcrumb>
                        <BreadcrumbList>
                            <BreadcrumbItem className="hidden md:block">
                                <BreadcrumbLink asChild>
                                    <Link href="/">Inicio</Link>
                                </BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator className="hidden md:block" />
                            <BreadcrumbItem>
                                <BreadcrumbPage>Activación en bloque</BreadcrumbPage>
                            </BreadcrumbItem>
                        </BreadcrumbList>
                    </Breadcrumb>
                </div>
            </header>

            <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-bold tracking-tight">Activación en bloque</h1>
                    <p className="max-w-3xl text-muted-foreground">
                        Activa muchas tarjetas físicas de una vez cuando el cliente las paga todas juntas.
                        Primero muévelas a la sede correcta en{" "}
                        <Link href="/cards/reassign" className="underline">Remisión de tarjetas</Link>
                        : una tarjeta activada ya no se puede mover.
                    </p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Lista de tarjetas</CardTitle>
                        <CardDescription>
                            Escanea o pega los códigos QR ({CARD_UUID_LENGTH} caracteres) o el enlace completo del QR,
                            separados por coma, espacio o salto de línea (máx. {BULK_ACTIVATION_MAX_CARDS}).
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <textarea
                            className="min-h-36 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            placeholder="FJ2ZSKXB, BZV2L2FQ, BUB7J53P"
                            value={uuidInput}
                            onChange={(event) => handleInputChange(event.target.value)}
                            disabled={running}
                            aria-invalid={parsed.invalid.length > 0 || overLimit}
                            aria-describedby="qr-count"
                        />
                        <div id="qr-count" className="space-y-2 text-sm" aria-live="polite">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant={overLimit ? "destructive" : "default"}>
                                    {parsed.codes.length} / {BULK_ACTIVATION_MAX_CARDS} QR a activar
                                </Badge>
                                {parsed.invalid.length > 0 && (
                                    <Badge variant="destructive">{parsed.invalid.length} inválido(s)</Badge>
                                )}
                                {parsed.duplicates > 0 && (
                                    <Badge variant="secondary">{parsed.duplicates} repetido(s), se cuentan una vez</Badge>
                                )}
                            </div>
                            {parsed.invalid.length > 0 && (
                                <div className="rounded-md border border-destructive/40 p-3 text-destructive">
                                    <p>
                                        No son códigos QR válidos: deben tener {CARD_UUID_LENGTH} caracteres
                                        (letras y números; nunca 0, 1, I ni O).
                                    </p>
                                    <p className="mt-1 break-all font-mono text-xs">
                                        {parsed.invalid.slice(0, 30).join(", ")}
                                        {parsed.invalid.length > 30 ? ` … y ${parsed.invalid.length - 30} más` : ""}
                                    </p>
                                    <Button variant="outline" size="sm" className="mt-2" onClick={removeInvalid} disabled={running}>
                                        Quitar inválidos
                                    </Button>
                                </div>
                            )}
                            {overLimit && (
                                <p className="text-destructive">
                                    Máximo {BULK_ACTIVATION_MAX_CARDS} por lote. Divide la lista y actívala en dos partes.
                                </p>
                            )}
                        </div>
                        <Button onClick={handlePreview} disabled={!inputReady || previewLoading || running}>
                            {previewLoading ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Validando...</>
                            ) : (
                                <><Search className="mr-2 h-4 w-4" />Validar {parsed.codes.length} tarjeta(s)</>
                            )}
                        </Button>
                    </CardContent>
                </Card>

                {preview && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Resumen</CardTitle>
                            <CardDescription>
                                {eligible.length} listas para activar · {blocked.length} bloqueadas
                                {preview.missing.length ? ` · ${preview.missing.length} no encontradas` : ""}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {preview.companies.map((summary) => (
                                <div key={summary.companyId} className="rounded-md border p-3 text-sm">
                                    <div className="font-medium">{summary.company} · {summary.count} tarjeta(s)</div>
                                    <div className="mt-1 text-muted-foreground">
                                        Total a cobrar:{" "}
                                        {summary.totals.map((t) => formatMoney(t.amount, t.currency, t.currency === "COP" ? 0 : 2)).join(" + ")}
                                    </div>
                                    <div className="text-muted-foreground">
                                        Saldo billetera: {formatMoney(summary.wallet.balance, summary.wallet.currency)}
                                        {summary.wallet.balanceAfter != null && (
                                            <> → después: <span className={summary.wallet.balanceAfter < 0 ? "font-medium text-destructive" : ""}>
                                                {formatMoney(summary.wallet.balanceAfter, summary.wallet.currency)}
                                            </span></>
                                        )}
                                    </div>
                                    {summary.wallet.balanceAfter != null && summary.wallet.balanceAfter < 0 && (
                                        <div className="mt-1 text-destructive">
                                            La billetera quedará en deuda. Registra primero el pago del cliente si ya lo hizo.
                                        </div>
                                    )}
                                </div>
                            ))}

                            {preview.missing.length > 0 && (
                                <p className="text-sm text-muted-foreground">
                                    No encontradas: <span className="font-mono">{preview.missing.join(", ")}</span>
                                </p>
                            )}

                            <div className="max-h-96 overflow-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>UUID</TableHead>
                                            <TableHead>Producto</TableHead>
                                            <TableHead>Sede</TableHead>
                                            <TableHead>Valor</TableHead>
                                            <TableHead>Estado</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {preview.cards.map((card) => (
                                            <TableRow key={card.uuid}>
                                                <TableCell className="font-mono text-xs">{card.uuid}</TableCell>
                                                <TableCell>{card.product}</TableCell>
                                                <TableCell>{card.company} — {card.store}</TableCell>
                                                <TableCell>
                                                    {card.billingAmount != null && card.billingCurrency
                                                        ? formatMoney(card.billingAmount, card.billingCurrency, card.billingCurrency === "COP" ? 0 : 2)
                                                        : "—"}
                                                </TableCell>
                                                <TableCell>
                                                    {card.canActivate
                                                        ? <Badge variant="secondary">Lista</Badge>
                                                        : <Badge variant="outline">{card.blockReason}</Badge>}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            <Button onClick={() => setConfirmOpen(true)} disabled={!eligible.length || running}>
                                {running ? (
                                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Activando {progress.done}/{progress.total}...</>
                                ) : (
                                    <><Zap className="mr-2 h-4 w-4" />Activar {eligible.length} tarjeta(s)</>
                                )}
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {(running || results.length > 0) && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Resultado</CardTitle>
                            <CardDescription>
                                {counts.COMPLETED} activadas · {counts.PROCESSING} en proceso · {counts.SKIPPED} omitidas · {counts.FAILED} fallidas
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {running && (
                                <div className="h-2 w-full overflow-hidden rounded bg-muted">
                                    <div
                                        className="h-full bg-primary transition-all"
                                        style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
                                    />
                                </div>
                            )}
                            {counts.PROCESSING > 0 && (
                                <p className="text-sm text-muted-foreground">
                                    Las tarjetas en proceso siguen solas (o esperan stock en Diem). Revísalas en Activaciones.
                                </p>
                            )}
                            <Button
                                variant="outline"
                                onClick={() => downloadResultsCsv(results, cardByUuid)}
                                disabled={!results.length}
                            >
                                <Download className="mr-2 h-4 w-4" />
                                Descargar CSV
                            </Button>
                            <div className="max-h-96 overflow-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>UUID</TableHead>
                                            <TableHead>Resultado</TableHead>
                                            <TableHead>Detalle</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {results.map((row) => (
                                            <TableRow key={row.uuid}>
                                                <TableCell className="font-mono text-xs">{row.uuid}</TableCell>
                                                <TableCell>
                                                    <Badge variant={outcomeVariant(row.outcome)}>{OUTCOME_LABEL[row.outcome]}</Badge>
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground">
                                                    {row.message ?? row.status ?? ""}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirmar activación en bloque</DialogTitle>
                        <DialogDescription asChild>
                            <div className="space-y-2">
                                <p>Vas a activar {eligible.length} tarjeta(s) y debitar su valor de la billetera del cliente.</p>
                                <p>
                                    <strong>Una tarjeta activada muestra su código a quien escanee el QR.</strong>{" "}
                                    Si se pierde o se la roban, se puede canjear. Confirma que el cliente lo aceptó.
                                </p>
                                <p>No cierres esta página hasta que termine.</p>
                            </div>
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
                        <Button onClick={handleActivate}>Activar {eligible.length} tarjeta(s)</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
