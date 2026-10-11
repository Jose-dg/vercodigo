"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { QRCodeSVG } from "qrcode.react";
import { AlertCircle, Check, CheckCircle2, Clock, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { TopUp } from "@/lib/devdiem/stored-value";
import { formatMoney } from "@/lib/wallet/balance";
import {
    BREB_MAX_PER_TRANSACTION_COP,
    TOPUP_MIN_COP,
    TOPUP_QUICK_AMOUNTS_COP,
    shortTopUpReference,
    topUpStatePresentation,
    validateTopUpAmount,
} from "@/lib/wallet/topups";
import { cn } from "@/lib/utils";

import { WALLET_SUMMARY_KEY } from "./wallet-balance-chip";

type Step = "amount" | "pay" | "status";

async function readJson(response: Response) {
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.message || "No pudimos completar la operación.");
    return body;
}

async function fetchTopUp(url: string): Promise<TopUp> {
    return (await readJson(await fetch(url, { cache: "no-store" }))).topUp;
}

function CopyField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
    const [copied, setCopied] = useState(false);
    return (
        <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2">
            <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={cn("truncate font-semibold", mono && "font-mono tracking-wide")}>{value}</p>
            </div>
            <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Copiar ${label.toLowerCase()}`}
                onClick={async () => {
                    await navigator.clipboard.writeText(value);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                }}
            >
                {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
            </Button>
        </div>
    );
}

export function TopUpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    const { mutate } = useSWRConfig();
    const [step, setStep] = useState<Step>("amount");
    const [amountInput, setAmountInput] = useState("");
    const [accepted, setAccepted] = useState(false);
    const [bankReference, setBankReference] = useState("");
    const [topUp, setTopUp] = useState<TopUp | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // One key per attempt: a retried request never opens a second top-up.
    const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

    const validation = useMemo(() => validateTopUpAmount(amountInput || 0), [amountInput]);
    const shouldPoll = step === "status" && topUp !== null && topUpStatePresentation(topUp.state).isOpen;
    const { data: live } = useSWR(
        shouldPoll ? `/api/wallet/topups/${topUp?.id}` : null,
        fetchTopUp,
        { refreshInterval: 10_000 },
    );
    const current = live ?? topUp;
    // A top-up left open ("Pagar más tarde") can be resumed instead of duplicated.
    const { data: existing } = useSWR(
        open && step === "amount" && !topUp ? "/api/wallet/topups" : null,
        async (url: string) => (await readJson(await fetch(url, { cache: "no-store" }))).topUps as TopUp[],
    );
    const resumable = existing?.find(
        (candidate) => candidate.state === "created" && new Date(candidate.expires_at) > new Date(),
    );

    useEffect(() => {
        if (live?.state === "credited") {
            mutate(WALLET_SUMMARY_KEY);
            toast.success("Recarga acreditada. Tu saldo ya está disponible.");
        }
    }, [live?.state, mutate]);

    function reset() {
        setStep("amount");
        setAmountInput("");
        setAccepted(false);
        setBankReference("");
        setTopUp(null);
        setError(null);
        setIdempotencyKey(crypto.randomUUID());
    }

    async function createTopUp() {
        if (!validation.ok || !accepted) return;
        setSubmitting(true);
        setError(null);
        try {
            const body = await readJson(
                await fetch("/api/wallet/topups", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
                    body: JSON.stringify({ amount: validation.amount, acceptedTerms: true }),
                }),
            );
            setTopUp(body.topUp);
            setStep("pay");
            mutate(WALLET_SUMMARY_KEY);
        } catch (cause) {
            setError((cause as Error).message);
        } finally {
            setSubmitting(false);
        }
    }

    async function reportPayment() {
        if (!topUp || bankReference.trim().length < 3) return;
        setSubmitting(true);
        setError(null);
        try {
            const body = await readJson(
                await fetch(`/api/wallet/topups/${topUp.id}/report`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ bankReference: bankReference.trim() }),
                }),
            );
            setTopUp(body.topUp);
            setStep("status");
            mutate(WALLET_SUMMARY_KEY);
        } catch (cause) {
            setError((cause as Error).message);
        } finally {
            setSubmitting(false);
        }
    }

    const currency = current?.currency ?? "COP";

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                onOpenChange(next);
                if (!next && (step === "status" || step === "amount")) reset();
            }}
        >
            <DialogContent className="sm:max-w-md">
                {step === "amount" ? (
                    <>
                        <DialogHeader>
                            <DialogTitle>Recargar saldo</DialogTitle>
                            <DialogDescription>
                                Paga por transferencia Bre-B. El saldo se suma cuando finanzas confirme el pago.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                            {resumable ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setTopUp(resumable);
                                        setStep("pay");
                                    }}
                                    className="flex w-full items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-left text-sm text-amber-900 transition-colors hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
                                >
                                    <span>
                                        Tienes una recarga pendiente de{" "}
                                        <strong className="tabular-nums">
                                            {formatMoney(Number(resumable.amount), resumable.currency)}
                                        </strong>
                                    </span>
                                    <span className="font-medium underline-offset-2 hover:underline">Continuar</span>
                                </button>
                            ) : null}
                            <div className="space-y-2">
                                <Label htmlFor="topup-amount">Monto a recargar</Label>
                                <Input
                                    id="topup-amount"
                                    inputMode="numeric"
                                    autoComplete="off"
                                    placeholder="$ 500.000"
                                    value={amountInput ? Number(amountInput).toLocaleString("es-CO") : ""}
                                    onChange={(event) => setAmountInput(event.target.value.replace(/[^\d]/g, ""))}
                                    aria-invalid={amountInput !== "" && !validation.ok}
                                    aria-describedby="topup-amount-help"
                                />
                                <p id="topup-amount-help" className="text-xs text-muted-foreground">
                                    {amountInput !== "" && !validation.ok
                                        ? validation.error
                                        : `Entre ${formatMoney(TOPUP_MIN_COP, "COP")} y ${formatMoney(BREB_MAX_PER_TRANSACTION_COP, "COP")} por transferencia.`}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2" role="group" aria-label="Montos sugeridos">
                                {TOPUP_QUICK_AMOUNTS_COP.map((quick) => (
                                    <Button
                                        key={quick}
                                        type="button"
                                        variant={Number(amountInput) === quick ? "default" : "outline"}
                                        size="sm"
                                        className="rounded-full"
                                        onClick={() => setAmountInput(String(quick))}
                                    >
                                        {formatMoney(quick, "COP")}
                                    </Button>
                                ))}
                            </div>
                            <label className="flex items-start gap-3 text-sm">
                                <Checkbox
                                    checked={accepted}
                                    onCheckedChange={(value) => setAccepted(value === true)}
                                    aria-label="Acepto las condiciones de la recarga"
                                />
                                <span className="text-muted-foreground">
                                    Entiendo que la recarga se acredita cuando finanzas confirma la transferencia, y
                                    que debo pagar el monto exacto con la referencia indicada.
                                </span>
                            </label>
                        </div>
                        {error ? (
                            <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
                                <AlertCircle className="size-4" /> {error}
                            </p>
                        ) : null}
                        <DialogFooter>
                            <Button onClick={createTopUp} disabled={!validation.ok || !accepted || submitting}>
                                {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
                                Continuar al pago
                            </Button>
                        </DialogFooter>
                    </>
                ) : null}

                {step === "pay" && current ? (
                    <>
                        <DialogHeader>
                            <DialogTitle>Transfiere con Bre-B</DialogTitle>
                            <DialogDescription>
                                Escanea el código desde la app de tu banco o usa la llave. Escribe el monto exacto y la
                                referencia en la descripción.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3">
                            {current.action?.kind === "display_qr" && current.action.qr_payload ? (
                                <div className="flex justify-center rounded-xl border bg-white p-4">
                                    <QRCodeSVG
                                        value={current.action.qr_payload}
                                        size={184}
                                        role="img"
                                        aria-label="Código QR Bre-B para pagar"
                                    />
                                </div>
                            ) : null}
                            <CopyField label="Monto exacto" value={formatMoney(Number(current.amount), currency)} />
                            <CopyField label="Referencia (descripción)" value={shortTopUpReference(current.id)} mono />
                            {current.action?.key ? <CopyField label="Llave Bre-B" value={current.action.key} mono /> : null}
                            <p className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Clock className="size-3.5" aria-hidden="true" />
                                Reporta tu pago antes de{" "}
                                {new Date(current.expires_at).toLocaleString("es-CO", {
                                    dateStyle: "medium",
                                    timeStyle: "short",
                                })}
                                .
                            </p>
                            <div className="space-y-2 border-t pt-3">
                                <Label htmlFor="topup-bank-ref">Referencia que te dio tu banco</Label>
                                <Input
                                    id="topup-bank-ref"
                                    autoComplete="off"
                                    placeholder="Ej. 4839201"
                                    value={bankReference}
                                    onChange={(event) => setBankReference(event.target.value)}
                                />
                            </div>
                        </div>
                        {error ? (
                            <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
                                <AlertCircle className="size-4" /> {error}
                            </p>
                        ) : null}
                        <DialogFooter className="gap-2 sm:justify-between">
                            <Button variant="ghost" onClick={() => onOpenChange(false)}>
                                Pagar más tarde
                            </Button>
                            <Button onClick={reportPayment} disabled={bankReference.trim().length < 3 || submitting}>
                                {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
                                Ya hice la transferencia
                            </Button>
                        </DialogFooter>
                    </>
                ) : null}

                {step === "status" && current ? (
                    <>
                        <DialogHeader>
                            <DialogTitle>{topUpStatePresentation(current.state).label}</DialogTitle>
                            <DialogDescription>{topUpStatePresentation(current.state).description}</DialogDescription>
                        </DialogHeader>
                        <div className="flex flex-col items-center gap-3 py-4 text-center" aria-live="polite">
                            {current.state === "credited" ? (
                                <CheckCircle2 className="size-12 text-emerald-600" aria-hidden="true" />
                            ) : topUpStatePresentation(current.state).isOpen ? (
                                <Loader2 className="size-12 animate-spin text-amber-500 motion-reduce:animate-none" aria-hidden="true" />
                            ) : (
                                <AlertCircle className="size-12 text-muted-foreground" aria-hidden="true" />
                            )}
                            <p className="text-2xl font-bold tabular-nums">{formatMoney(Number(current.amount), currency)}</p>
                            <p className="font-mono text-sm text-muted-foreground">{shortTopUpReference(current.id)}</p>
                            {topUpStatePresentation(current.state).isOpen ? (
                                <p className="text-xs text-muted-foreground">
                                    Puedes cerrar esta ventana: te avisamos en el indicador de saldo.
                                </p>
                            ) : null}
                        </div>
                        <DialogFooter>
                            <Button onClick={() => onOpenChange(false)}>Listo</Button>
                        </DialogFooter>
                    </>
                ) : null}
            </DialogContent>
        </Dialog>
    );
}
