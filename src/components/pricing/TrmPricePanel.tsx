"use client";

import { useState } from "react";
import useSWR from "swr";
import { AlertTriangle, Landmark, Loader2, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/wallet/balance";

const TRM_KEY = "/api/pricing/trm";

type TrmPriceList = {
    rate: {
        trm: { valueCop: number; validFrom: string; validTo: string; source: string; stale: boolean };
        roundedTrmCop: number;
        spreadCop: number;
        rateCopPerUsd: number;
    } | null;
    products: {
        denominationId: string;
        productName: string;
        brand: string;
        amountUsd: number;
        priceCop: number | null;
        configuredCost?: { cost: number; currency: string } | null;
    }[];
};

async function fetchPriceList(url: string): Promise<TrmPriceList> {
    const response = await fetch(url, { cache: "no-store" });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.message || "No se pudo cargar la TRM");
    return data;
}

const dateFormat = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", timeZone: "UTC" });
function formatDay(value: string) {
    return dateFormat.format(new Date(`${value}T00:00:00Z`));
}
function formatValidity(from: string, to: string) {
    return from === to ? formatDay(from) : `${formatDay(from)} – ${formatDay(to)}`;
}

/**
 * Precio de los productos de región USA a partir de la TRM oficial del día: reemplaza
 * la revisión manual diaria de tasas. La plataforma ajusta el margen sobre la TRM.
 */
export function TrmPricePanel({ isPlatform }: { isPlatform: boolean }) {
    const { data, error, isLoading, mutate } = useSWR(TRM_KEY, fetchPriceList, { revalidateOnFocus: true });
    // null mientras no se edita: se muestra el margen guardado.
    const [spreadDraft, setSpreadDraft] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const rate = data?.rate ?? null;
    const spreadValue = spreadDraft ?? (rate ? String(rate.spreadCop) : "");

    async function saveSpread() {
        const spreadCop = Number(spreadValue);
        if (!Number.isInteger(spreadCop) || spreadCop < 0) {
            toast.error("El margen debe ser un número entero de pesos");
            return;
        }
        setSaving(true);
        try {
            const response = await fetch(TRM_KEY, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ spreadCop }),
            });
            const body = await response.json().catch(() => null);
            if (!response.ok) throw new Error(body?.message || "No se pudo guardar el margen");
            toast.success("Margen actualizado para las próximas compras");
            await mutate();
            setSpreadDraft(null);
        } catch (saveError) {
            toast.error(saveError instanceof Error ? saveError.message : "No se pudo guardar el margen");
        } finally {
            setSaving(false);
        }
    }

    if (isLoading) {
        return (
            <div role="status" aria-live="polite" className="space-y-4">
                <span className="sr-only">Cargando TRM…</span>
                <Skeleton className="h-40 rounded-xl" />
                <Skeleton className="h-72 rounded-xl" />
            </div>
        );
    }

    if (error && !data) {
        return (
            <Card className="shadow-none">
                <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6 text-sm text-muted-foreground">
                    {error instanceof Error ? error.message : "No se pudo cargar la TRM"}
                    <Button variant="outline" size="sm" onClick={() => void mutate()}>
                        <RefreshCw className="size-4" aria-hidden="true" /> Reintentar
                    </Button>
                </CardContent>
            </Card>
        );
    }

    const spreadChanged = rate != null && spreadValue !== String(rate.spreadCop);

    return (
        <div className="space-y-4">
            <Card className="shadow-none">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Landmark className="size-5" aria-hidden="true" />
                        Tasa del día para productos USA
                    </CardTitle>
                    <CardDescription>
                        TRM oficial de Superfinanciera (datos.gov.co), redondeada hacia abajo a la decena. Se consulta sola
                        en la primera compra del día y aplica a las denominaciones USD de región USA.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {!rate ? (
                        <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                            La TRM no está disponible en este momento. Mientras tanto se cobran los costos configurados.
                        </p>
                    ) : (
                        <>
                            {rate.trm.stale && (
                                <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                                    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                                    No se pudo consultar la TRM de hoy: se usa la vigente {formatValidity(rate.trm.validFrom, rate.trm.validTo)}.
                                </p>
                            )}
                            <dl className="grid gap-3 sm:grid-cols-4">
                                <div className="rounded-lg border p-3">
                                    <dt className="text-xs text-muted-foreground">TRM oficial · {formatValidity(rate.trm.validFrom, rate.trm.validTo)}</dt>
                                    <dd className="mt-1 font-mono text-lg tabular-nums">{formatMoney(rate.trm.valueCop, "COP", 2)}</dd>
                                </div>
                                <div className="rounded-lg border p-3">
                                    <dt className="text-xs text-muted-foreground">Redondeada (decena hacia abajo)</dt>
                                    <dd className="mt-1 font-mono text-lg tabular-nums">{formatMoney(rate.roundedTrmCop, "COP")}</dd>
                                </div>
                                <div className="rounded-lg border p-3">
                                    <dt className="text-xs text-muted-foreground">Margen</dt>
                                    <dd className="mt-1 font-mono text-lg tabular-nums">+ {formatMoney(rate.spreadCop, "COP")}</dd>
                                </div>
                                <div className="rounded-lg border border-primary/40 bg-primary/5 p-3">
                                    <dt className="text-xs text-muted-foreground">Tasa mayorista COP/USD</dt>
                                    <dd className="mt-1 font-mono text-2xl font-semibold tabular-nums text-primary">{formatMoney(rate.rateCopPerUsd, "COP")}</dd>
                                </div>
                            </dl>
                            {isPlatform && (
                                <form
                                    className="flex flex-wrap items-end gap-3"
                                    onSubmit={(event) => {
                                        event.preventDefault();
                                        void saveSpread();
                                    }}
                                >
                                    <div className="space-y-1.5">
                                        <Label htmlFor="trm-spread">Margen sobre la TRM (pesos por dólar)</Label>
                                        <Input
                                            id="trm-spread"
                                            type="number"
                                            inputMode="numeric"
                                            min={0}
                                            step={10}
                                            className="w-40 font-mono"
                                            value={spreadValue}
                                            onChange={(event) => setSpreadDraft(event.target.value)}
                                        />
                                    </div>
                                    <Button type="submit" disabled={saving || !spreadChanged}>
                                        {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
                                        Guardar margen
                                    </Button>
                                </form>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            <Card className="shadow-none">
                <CardHeader>
                    <CardTitle>Precios de hoy · región USA</CardTitle>
                    <CardDescription>
                        Lo que paga cada mayorista por unidad con la tasa del día.
                        {isPlatform && " El costo configurado aplica solo si no hay TRM disponible."}
                    </CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                    <Table className="min-w-[520px]">
                        <TableHeader>
                            <TableRow>
                                <TableHead>Producto</TableHead>
                                <TableHead className="text-right">USD</TableHead>
                                <TableHead className="text-right">Precio hoy</TableHead>
                                {isPlatform && <TableHead className="text-right">Costo configurado</TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {(data?.products ?? []).length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={isPlatform ? 4 : 3} className="h-20 text-center text-muted-foreground">
                                        Aún no hay productos de región USA sincronizados. Se sincronizan al abrir el catálogo de compra.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                data!.products.map((product) => (
                                    <TableRow key={product.denominationId}>
                                        <TableCell>
                                            <div className="font-medium">{product.productName}</div>
                                            <div className="text-xs text-muted-foreground">{product.brand}</div>
                                        </TableCell>
                                        <TableCell className="text-right font-mono tabular-nums">US${product.amountUsd}</TableCell>
                                        <TableCell className="text-right font-mono font-medium tabular-nums">
                                            {product.priceCop != null ? formatMoney(product.priceCop, "COP") : "—"}
                                        </TableCell>
                                        {isPlatform && (
                                            <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                                                {product.configuredCost
                                                    ? formatMoney(product.configuredCost.cost, product.configuredCost.currency)
                                                    : "—"}
                                            </TableCell>
                                        )}
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
