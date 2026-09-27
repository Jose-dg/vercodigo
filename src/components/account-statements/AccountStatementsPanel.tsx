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

    const load = useCallback(async () => {
        try {
            const response = await fetch("/api/account-statements");
            const data = await response.json();
            if (!response.ok) throw new Error(data.message);
            setStatements(data.statements ?? []);
        } catch {
            toast.error("No se pudieron cargar los estados de cuenta");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    return (
        <Card>
            <CardHeader className="border-b">
                <div className="flex items-start gap-3">
                    <div className="mt-0.5 grid size-9 place-items-center rounded-md bg-[#123f68] text-white">
                        <FileText className="size-4" />
                    </div>
                    <div>
                        <CardTitle>Estados de cuenta</CardTitle>
                        <CardDescription className="mt-1">Documentos informativos emitidos por Vercode.</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-4">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Número</TableHead>
                            <TableHead>Periodo</TableHead>
                            <TableHead className="text-right">Resultado</TableHead>
                            <TableHead className="text-right">Documento</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={4} className="h-20 text-center">Cargando…</TableCell></TableRow>
                        ) : statements.length === 0 ? (
                            <TableRow><TableCell colSpan={4} className="h-20 text-center text-muted-foreground">Aún no hay estados de cuenta emitidos.</TableCell></TableRow>
                        ) : statements.map((statement) => {
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
                                                <Download /> Descargar PDF
                                            </a>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
