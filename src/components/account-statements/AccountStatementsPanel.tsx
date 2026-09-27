"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, FileText } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type StatementSummary = {
    id: string;
    statementNumber: string;
    currency: string;
    periodStart: string;
    periodEnd: string;
    totalPending: string;
    creditBalance: string;
    issuedAt: string;
};

function money(value: string, currency: string) {
    return new Intl.NumberFormat("es-CO", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value));
}

export function AccountStatementsPanel() {
    const [statements, setStatements] = useState<StatementSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const response = await fetch("/api/account-statements");
            const data = await response.json();
            if (!response.ok) throw new Error(data.message);
            setStatements(data.statements ?? []);
        } catch {
            const message = "No se pudieron cargar los estados de cuenta. Intenta nuevamente.";
            setError(message);
            toast.error(message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    return (
        <Card className="shadow-none">
            <CardHeader className="border-b">
                <div className="flex items-start gap-3">
                    <div className="mt-0.5 grid size-9 place-items-center rounded-md bg-[#123f68] text-white">
                        <FileText aria-hidden="true" className="size-4" />
                    </div>
                    <div>
                        <CardTitle>Estados de cuenta</CardTitle>
                        <CardDescription className="mt-1">Documentos informativos emitidos por Vercode.</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-5">
                {error ? (
                    <div className="flex flex-col items-start gap-3 border-l-2 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-950" role="alert">
                        <p>{error}</p>
                        <Button variant="outline" size="sm" onClick={load}>Reintentar</Button>
                    </div>
                ) : loading ? (
                    <div className="py-8 text-center text-sm text-muted-foreground" role="status">Cargando estados de cuenta…</div>
                ) : statements.length === 0 ? (
                    <div className="border-l-2 border-[#123f68] bg-slate-50 px-5 py-4">
                        <p className="font-medium text-foreground">El primer estado todavía no ha sido emitido.</p>
                        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                            Cuando Vercode cierre el periodo, el documento aparecerá aquí para consulta y descarga.
                        </p>
                    </div>
                ) : (
                <div className="overflow-x-auto">
                <Table className="min-w-[680px]">
                    <TableHeader>
                        <TableRow>
                            <TableHead>Número</TableHead>
                            <TableHead>Periodo</TableHead>
                            <TableHead className="text-right">Resultado</TableHead>
                            <TableHead className="text-right">Documento</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {statements.map((statement) => {
                            const hasDebt = Number(statement.totalPending) > 0;
                            return (
                                <TableRow key={statement.id}>
                                    <TableCell className="font-medium">{statement.statementNumber}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {new Date(statement.periodStart).toLocaleDateString("es-CO")} – {new Date(statement.periodEnd).toLocaleDateString("es-CO")}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        <span className={hasDebt ? "font-semibold text-red-700" : "text-emerald-700"}>
                                            {hasDebt ? "Pendiente " : "A favor "}
                                            {money(hasDebt ? statement.totalPending : statement.creditBalance, statement.currency)}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="outline" size="sm" asChild>
                                            <a href={`/api/account-statements/${statement.id}/pdf`} target="_blank" rel="noreferrer">
                                                <Download aria-hidden="true" /> Descargar PDF
                                            </a>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
                </div>
                )}
            </CardContent>
        </Card>
    );
}
