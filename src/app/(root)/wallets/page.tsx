"use client";

import { useCallback, useEffect, useState } from "react";
import { useAbility } from "@/components/auth/ability-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { List, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AccountStatementDialog } from "@/components/account-statements/AccountStatementDialog";
import { useWalletMovements, WalletMovementsTable, type WalletMovement } from "@/components/wallet/wallet-movements-table";
import { CorrectRechargeTimeDialog } from "@/components/wallet/correct-recharge-time-dialog";
import { bogotaLocalNow, bogotaLocalToIso } from "@/lib/wallet/effective-time";

interface WalletSummary {
    companyId: string;
    companyName: string;
    currency: string;
    balance: number;
    pendingTransactions: number;
    updatedAt: string | null;
}

interface FxRate {
    key: string;
    rate: number;
    updatedAt: string;
}

function formatMoney(amount: number, currency: string) {
    return new Intl.NumberFormat("es-CO", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
}

/** Keyed by company so page and filter start fresh for each one. */
function CompanyMovements({ companyId, onLedgerChanged }: { companyId: string; onLedgerChanged: () => void }) {
    const movements = useWalletMovements(`/api/wallets/${encodeURIComponent(companyId)}/transactions`);
    const [correcting, setCorrecting] = useState<WalletMovement | null>(null);
    return (
        <>
            <WalletMovementsTable movements={movements} onCorrectPaidAt={setCorrecting} />
            <CorrectRechargeTimeDialog
                movement={correcting}
                currency={movements.data?.wallet.currency ?? "COP"}
                onOpenChange={(open) => {
                    if (!open) setCorrecting(null);
                }}
                onCorrected={() => {
                    void movements.reload();
                    onLedgerChanged();
                }}
            />
        </>
    );
}

export default function WalletsAdminPage() {
    const ability = useAbility();
    const [wallets, setWallets] = useState<WalletSummary[]>([]);
    const [rates, setRates] = useState<FxRate[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    // Formulario de abono
    const [rechargeCompanyId, setRechargeCompanyId] = useState("");
    const [rechargeAmount, setRechargeAmount] = useState("");
    const [rechargeReference, setRechargeReference] = useState("");
    const [rechargeDescription, setRechargeDescription] = useState("");
    // Hora del pago en Colombia (datetime-local). Sin valor por defecto: la
    // hora de registro nunca debe pasar por hora del pago.
    const [rechargePaidAt, setRechargePaidAt] = useState("");
    // Una clave por intento de abono; los reintentos reutilizan la misma.
    const [rechargeKey, setRechargeKey] = useState("");

    const [movementsCompany, setMovementsCompany] = useState<WalletSummary | null>(null);

    // Formulario tasa FX
    const [fxRate, setFxRate] = useState("");

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [wRes, fxRes] = await Promise.all([fetch("/api/wallets"), fetch("/api/wallets/fx")]);
            if (!wRes.ok) throw new Error("wallets");
            const wData = await wRes.json();
            setWallets(wData.wallets ?? []);
            if (fxRes.ok) {
                const fxData = await fxRes.json();
                setRates(fxData.rates ?? []);
                const usdCop = (fxData.rates ?? []).find((r: FxRate) => r.key === "FX_USD_COP");
                if (usdCop) setFxRate(String(usdCop.rate));
            }
        } catch {
            toast.error("Error cargando wallets");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (ability.can("manage", "Wallet")) {
            fetchData();
        }
    }, [ability, fetchData]);

    const openRecharge = (companyId: string) => {
        setRechargeCompanyId(companyId);
        setRechargeAmount("");
        setRechargeReference("");
        setRechargeDescription("");
        setRechargePaidAt("");
        setRechargeKey(crypto.randomUUID());
        setIsSheetOpen(true);
    };

    const submitRecharge = async () => {
        const amount = parseFloat(rechargeAmount);
        if (!rechargeCompanyId || !(amount > 0)) {
            toast.error("Monto inválido");
            return;
        }
        if (!rechargeReference.trim()) {
            toast.error("Ingresa la referencia de la transferencia");
            return;
        }
        let paidAt: string;
        try {
            paidAt = bogotaLocalToIso(rechargePaidAt);
        } catch {
            toast.error("Ingresa la fecha y hora del pago");
            return;
        }
        setSaving(true);
        try {
            const res = await fetch("/api/wallets/recharge", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Idempotency-Key": rechargeKey },
                body: JSON.stringify({
                    companyId: rechargeCompanyId,
                    amount,
                    paidAt,
                    externalReference: rechargeReference.trim(),
                    description: rechargeDescription || undefined,
                }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.message || "Error registrando abono");
            toast.success(body.replayed ? "Este abono ya estaba registrado" : "Abono registrado");
            setIsSheetOpen(false);
            fetchData();
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setSaving(false);
        }
    };

    const saveFxRate = async () => {
        const rate = parseFloat(fxRate);
        if (!(rate > 0)) {
            toast.error("Tasa inválida");
            return;
        }
        setSaving(true);
        try {
            const res = await fetch("/api/wallets/fx", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key: "FX_USD_COP", rate }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || "Error guardando tasa");
            }
            toast.success("Tasa FX_USD_COP actualizada");
            fetchData();
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setSaving(false);
        }
    };

    if (!ability.can("manage", "Wallet")) {
        return <div className="p-8">No tienes permisos para ver esta página.</div>;
    }

    const selectedCompany = wallets.find((w) => w.companyId === rechargeCompanyId);
    const totalPending = wallets.reduce((sum, w) => sum + w.pendingTransactions, 0);

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">Wallets</h1>
                <Button variant="outline" onClick={fetchData} disabled={loading}>
                    <RefreshCw className="mr-2 h-4 w-4" /> Actualizar
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Tasa de cambio USD → COP</CardTitle>
                        <CardDescription>
                            Se aplica al convertir consumos en USD a wallets en COP.
                            {rates.length === 0 && " Sin tasa configurada: los consumos quedan PENDIENTES."}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex gap-2 items-end">
                        <div className="space-y-1">
                            <Label htmlFor="fx">1 USD =</Label>
                            <Input
                                id="fx"
                                type="number"
                                min="0"
                                step="0.01"
                                value={fxRate}
                                onChange={(e) => setFxRate(e.target.value)}
                                placeholder="4000"
                                className="w-40"
                            />
                        </div>
                        <Button onClick={saveFxRate} disabled={saving}>Guardar</Button>
                    </CardContent>
                </Card>

                {totalPending > 0 && (
                    <Card className="border-yellow-400">
                        <CardHeader>
                            <CardTitle className="text-yellow-700">Consumos pendientes de tasa</CardTitle>
                            <CardDescription>
                                Hay {totalPending} transacción(es) registradas sin tasa FX o sin precio.
                                No afectaron el balance; configura la tasa o el precio y ajústalas manualmente.
                            </CardDescription>
                        </CardHeader>
                    </Card>
                )}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Balance por compañía</CardTitle>
                    <CardDescription>Balance negativo = deuda de la compañía con la plataforma.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Compañía</TableHead>
                                <TableHead>Moneda</TableHead>
                                <TableHead className="text-right">Balance</TableHead>
                                <TableHead className="text-right">Pendientes</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-24">Cargando...</TableCell>
                                </TableRow>
                            ) : wallets.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-24">Sin compañías.</TableCell>
                                </TableRow>
                            ) : (
                                wallets.map((w) => (
                                    <TableRow key={w.companyId}>
                                        <TableCell className="font-medium">{w.companyName}</TableCell>
                                        <TableCell>{w.currency}</TableCell>
                                        <TableCell
                                            className={`text-right font-mono ${w.balance < 0 ? "text-red-600 font-semibold" : ""}`}
                                        >
                                            {formatMoney(w.balance, w.currency)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {w.pendingTransactions > 0 ? (
                                                <span className="px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-800">
                                                    {w.pendingTransactions}
                                                </span>
                                            ) : (
                                                "—"
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex flex-wrap justify-end gap-2">
                                                <Button size="sm" variant="outline" onClick={() => setMovementsCompany(w)}>
                                                    <List className="mr-1 h-4 w-4" /> Movimientos
                                                </Button>
                                                <AccountStatementDialog companyId={w.companyId} companyName={w.companyName} />
                                                <Button size="sm" onClick={() => openRecharge(w.companyId)}>
                                                    <Plus className="mr-1 h-4 w-4" /> Abono
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                <SheetContent side="right" className="sm:max-w-md">
                    <SheetHeader>
                        <SheetTitle>Registrar abono</SheetTitle>
                        <SheetDescription>
                            {selectedCompany
                                ? `Acredita saldo a ${selectedCompany.companyName} (${selectedCompany.currency}). Úsalo solo tras confirmar el pago externo.`
                                : "Acredita saldo a la wallet de la compañía."}
                        </SheetDescription>
                    </SheetHeader>
                    <div className="mt-2 px-4 pb-6 space-y-4">
                        <div className="space-y-1">
                            <Label htmlFor="amount">Monto ({selectedCompany?.currency ?? ""})</Label>
                            <Input
                                id="amount"
                                type="number"
                                min="0"
                                step="0.01"
                                value={rechargeAmount}
                                onChange={(e) => setRechargeAmount(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="paidAt">Fecha y hora del pago (hora Colombia)</Label>
                            <Input
                                id="paidAt"
                                type="datetime-local"
                                required
                                max={bogotaLocalNow()}
                                value={rechargePaidAt}
                                onChange={(e) => setRechargePaidAt(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                                La del comprobante bancario. El movimiento se ordena y se reporta con esta hora.
                            </p>
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="reference"># Referencia de transferencia</Label>
                            <Input
                                id="reference"
                                required
                                value={rechargeReference}
                                onChange={(e) => setRechargeReference(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="description">Descripción (opcional)</Label>
                            <Input
                                id="description"
                                value={rechargeDescription}
                                onChange={(e) => setRechargeDescription(e.target.value)}
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="outline" onClick={() => setIsSheetOpen(false)}>Cancelar</Button>
                            <Button onClick={submitRecharge} disabled={saving}>
                                {saving ? "Guardando..." : "Registrar abono"}
                            </Button>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>

            <Sheet open={movementsCompany !== null} onOpenChange={(open) => !open && setMovementsCompany(null)}>
                <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-4xl">
                    <SheetHeader>
                        <SheetTitle>Movimientos · {movementsCompany?.companyName}</SheetTitle>
                        <SheetDescription>Movimientos de la wallet desde el saldo anterior, por fecha efectiva.</SheetDescription>
                    </SheetHeader>
                    <div className="px-4 pb-6">
                        {movementsCompany ? (
                            <CompanyMovements key={movementsCompany.companyId} companyId={movementsCompany.companyId} onLedgerChanged={fetchData} />
                        ) : null}
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}
