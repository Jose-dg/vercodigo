"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import useSWR, { useSWRConfig } from "swr";
import { QRCodeCanvas } from "qrcode.react";
import {
    AlertCircle,
    ArrowRight,
    Check,
    CheckCircle2,
    Circle,
    Clock,
    Copy,
    Download,
    Info,
    Loader2,
    Share2,
    XCircle,
} from "lucide-react";
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
import { BALANCE_TONE_CLASS, balancePresentation, formatMoney } from "@/lib/wallet/balance";
import { postFormWithProgress, receiptForm, sendReceiptBatches, type UploadResult } from "@/lib/wallet/receipt-upload";
import {
    EVIDENCE_MAX_FILES,
    evidenceCountLabel,
    isEvidenceStorageError,
    planEvidenceBatches,
} from "@/lib/wallet/topup-evidence";
import {
    BREB_MAX_PER_TRANSACTION_COP,
    TOPUP_MIN_COP,
    TOPUP_QUICK_AMOUNTS_COP,
    balanceAfterTopUp,
    debtSettlementAmount,
    shortTopUpReference,
    timeRemaining,
    topUpInstructionsText,
    topUpStatePresentation,
    topUpTimeline,
    validateTopUpAmount,
    type TimelineStep,
} from "@/lib/wallet/topups";
import { cn } from "@/lib/utils";

import { ReceiptPicker, useReceipts } from "./receipt-picker";
import { WALLET_SUMMARY_KEY, useWalletSummary } from "./wallet-balance-chip";

export const WALLET_TOPUPS_KEY = "/api/wallet/topups";

type Step = "amount" | "pay" | "status";
const STEPS: Array<{ key: Step; label: string }> = [
    { key: "amount", label: "Monto" },
    { key: "pay", label: "Pago" },
    { key: "status", label: "Confirmación" },
];

async function readJson(response: Response) {
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.message || "No pudimos completar la operación. Intenta de nuevo.");
    return body;
}

function uploadMessage(result: UploadResult) {
    const message = result.body.message;
    return typeof message === "string" && message ? message : "No pudimos subir el comprobante. Intenta de nuevo.";
}

const RECEIPT_STORAGE_NOTICE =
    "Tu pago quedó reportado, pero no pudimos guardar el comprobante en este momento. Intenta adjuntarlo de nuevo aquí en unos minutos.";

async function fetchTopUp(url: string): Promise<TopUp> {
    return (await readJson(await fetch(url, { cache: "no-store" }))).topUp;
}

async function fetchTopUps(url: string): Promise<TopUp[]> {
    return (await readJson(await fetch(url, { cache: "no-store" }))).topUps;
}

function stepFor(topUp: TopUp): Step {
    return topUp.state === "created" ? "pay" : "status";
}

function formatDateTime(value: string) {
    return new Date(value).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

/** Re-renders every `ms` so countdowns stay current while the dialog is open. */
function useNow(ms: number, active: boolean) {
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        if (!active) return;
        const id = setInterval(() => setNow(new Date()), ms);
        return () => clearInterval(id);
    }, [ms, active]);
    return now;
}

function Stepper({ current }: { current: Step }) {
    const currentIndex = STEPS.findIndex((step) => step.key === current);
    return (
        <ol className="flex items-center gap-2" aria-label="Pasos de la recarga">
            {STEPS.map((step, index) => {
                const done = index < currentIndex;
                const active = index === currentIndex;
                return (
                    <li key={step.key} className="flex flex-1 items-center gap-2" aria-current={active ? "step" : undefined}>
                        <span
                            className={cn(
                                "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                                done && "border-primary bg-primary text-primary-foreground",
                                active && "border-primary text-primary",
                                !done && !active && "text-muted-foreground",
                            )}
                        >
                            {done ? <Check className="size-3.5" aria-hidden="true" /> : index + 1}
                        </span>
                        <span className={cn("text-xs font-medium", active ? "text-foreground" : "text-muted-foreground")}>
                            {step.label}
                        </span>
                        {index < STEPS.length - 1 ? (
                            <span className={cn("h-px flex-1", done ? "bg-primary" : "bg-border")} aria-hidden="true" />
                        ) : null}
                    </li>
                );
            })}
        </ol>
    );
}

function CopyField({ label, value, mono = false, emphasis = false }: {
    label: string;
    value: string;
    mono?: boolean;
    emphasis?: boolean;
}) {
    const [copied, setCopied] = useState(false);
    return (
        <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2.5">
            <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={cn("truncate font-semibold", mono && "font-mono tracking-wide", emphasis && "text-lg tabular-nums")}>
                    {value}
                </p>
            </div>
            <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Copiar ${label.toLowerCase()}`}
                onClick={async () => {
                    await navigator.clipboard.writeText(value);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                }}
            >
                {copied ? <Check className="size-4 text-emerald-600" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
                <span className="sr-only sm:not-sr-only">{copied ? "Copiado" : "Copiar"}</span>
            </Button>
        </div>
    );
}

function TimelineIcon({ status }: { status: TimelineStep["status"] }) {
    if (status === "done") return <CheckCircle2 className="size-5 text-emerald-600" aria-hidden="true" />;
    if (status === "current") return <Loader2 className="size-5 animate-spin text-amber-500 motion-reduce:animate-none" aria-hidden="true" />;
    if (status === "stopped") return <XCircle className="size-5 text-muted-foreground" aria-hidden="true" />;
    return <Circle className="size-5 text-muted-foreground/50" aria-hidden="true" />;
}

export function TopUpDialog({ open, resume, onOpenChange }: {
    open: boolean;
    resume: TopUp | null;
    onOpenChange: (open: boolean) => void;
}) {
    const { mutate } = useSWRConfig();
    const { data: summary } = useWalletSummary();
    const [step, setStep] = useState<Step>("amount");
    const [amountInput, setAmountInput] = useState("");
    const [accepted, setAccepted] = useState(false);
    const [bankReference, setBankReference] = useState("");
    const [topUp, setTopUp] = useState<TopUp | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // One key per attempt: a retried request never opens a second top-up.
    const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
    const qrRef = useRef<HTMLCanvasElement>(null);
    // Focus follows the step title so screen readers announce where the user is.
    const titleRef = useRef<HTMLHeadingElement>(null);
    useEffect(() => {
        if (!open) return;
        const id = requestAnimationFrame(() => titleRef.current?.focus());
        return () => cancelAnimationFrame(id);
    }, [open, step]);

    useEffect(() => {
        if (open && resume) {
            setTopUp(resume);
            setStep(stepFor(resume));
            setError(null);
        }
    }, [open, resume]);

    const now = useNow(30_000, open && step === "pay");
    const validation = useMemo(() => validateTopUpAmount(amountInput || 0), [amountInput]);
    const balance = summary?.balance ?? 0;
    const currency = summary?.currency ?? "COP";
    const settle = debtSettlementAmount(balance);
    const preview = validation.ok ? balanceAfterTopUp(balance, validation.amount) : null;

    const shouldPoll = open && step === "status" && topUp !== null && topUpStatePresentation(topUp.state).isOpen;
    const { data: live } = useSWR(shouldPoll ? `/api/wallet/topups/${topUp?.id}` : null, fetchTopUp, {
        refreshInterval: 10_000,
    });
    const current = live ?? topUp;
    const liveKey = topUp ? `/api/wallet/topups/${topUp.id}` : null;
    // Receipts chosen in the pay step travel with the report; under review they are added later.
    const attachedCount = step === "status" ? current?.evidence_count ?? 0 : 0;
    const receipts = useReceipts(attachedCount);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [receiptNotice, setReceiptNotice] = useState<string | null>(null);

    const { data: existing } = useSWR(open && step === "amount" && !topUp ? WALLET_TOPUPS_KEY : null, fetchTopUps);
    const resumable = existing?.find((candidate) => candidate.state === "created" && !timeRemaining(candidate.expires_at).expired);

    useEffect(() => {
        if (live?.state === "credited") {
            mutate(WALLET_SUMMARY_KEY);
            mutate(WALLET_TOPUPS_KEY);
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
        receipts.drop();
        setReceiptNotice(null);
    }

    async function createTopUp() {
        if (!validation.ok || !accepted) return;
        setSubmitting(true);
        setError(null);
        try {
            const body = await readJson(
                await fetch(WALLET_TOPUPS_KEY, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
                    body: JSON.stringify({ amount: validation.amount, acceptedTerms: true }),
                }),
            );
            setTopUp(body.topUp);
            setStep("pay");
            mutate(WALLET_SUMMARY_KEY);
            mutate(WALLET_TOPUPS_KEY);
        } catch (cause) {
            setError((cause as Error).message);
        } finally {
            setSubmitting(false);
        }
    }

    async function reportPayment() {
        if (!topUp || bankReference.trim().length < 3) return;
        const reportUrl = `${WALLET_TOPUPS_KEY}/${topUp.id}/report`;
        const evidenceUrl = `${WALLET_TOPUPS_KEY}/${topUp.id}/evidence`;
        const reference = bankReference.trim();
        const reportPlain = async (): Promise<TopUp> => (await readJson(
            await fetch(reportUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bankReference: reference }),
            }),
        )).topUp;
        // The first batch goes with the report (all or nothing); the rest are added right after.
        const batches = planEvidenceBatches(receipts.receipts.map((receipt) => receipt.file));
        setSubmitting(true);
        setError(null);
        setReceiptNotice(null);
        try {
            let reported: TopUp;
            let notice: string | null = null;
            if (batches.length === 0) {
                reported = await reportPlain();
            } else {
                setUploadProgress(0);
                const [first] = batches;
                const results = await sendReceiptBatches(
                    batches,
                    (batch, onProgress) => postFormWithProgress(
                        batch === first ? reportUrl : evidenceUrl,
                        receiptForm(batch, batch === first ? { bankReference: reference } : {}),
                        onProgress,
                    ),
                    setUploadProgress,
                );
                const [report, ...added] = results;
                if (isEvidenceStorageError(report.status, report.body.error)) {
                    // Never lose the report for a receipt: report without it and keep the files to retry.
                    reported = await reportPlain();
                    notice = RECEIPT_STORAGE_NOTICE;
                } else if (!report.ok) {
                    throw new Error(uploadMessage(report));
                } else {
                    const delivered = results.filter((result) => result.ok);
                    reported = delivered[delivered.length - 1].body.topUp as TopUp;
                    receipts.drop(batches.slice(0, delivered.length).flat());
                    const failed = added.find((result) => !result.ok);
                    if (failed) notice = `Tu pago quedó reportado. ${uploadMessage(failed)}`;
                }
            }
            setTopUp(reported);
            setReceiptNotice(notice);
            setStep("status");
            mutate(WALLET_SUMMARY_KEY);
            mutate(WALLET_TOPUPS_KEY);
        } catch (cause) {
            setError((cause as Error).message);
        } finally {
            setSubmitting(false);
            setUploadProgress(null);
        }
    }

    async function attachReceipts() {
        if (!current || receipts.receipts.length === 0) return;
        const url = `${WALLET_TOPUPS_KEY}/${current.id}/evidence`;
        const batches = planEvidenceBatches(receipts.receipts.map((receipt) => receipt.file));
        setSubmitting(true);
        setUploadProgress(0);
        setReceiptNotice(null);
        receipts.setError(null);
        try {
            const results = await sendReceiptBatches(
                batches,
                (batch, onProgress) => postFormWithProgress(url, receiptForm(batch), onProgress),
                setUploadProgress,
            );
            const delivered = results.filter((result) => result.ok);
            receipts.drop(batches.slice(0, delivered.length).flat());
            if (delivered.length > 0) {
                const updated = delivered[delivered.length - 1].body.topUp as TopUp;
                setTopUp(updated);
                if (liveKey) mutate(liveKey, updated, { revalidate: false });
                mutate(WALLET_TOPUPS_KEY);
            }
            const failed = results.find((result) => !result.ok);
            if (failed) receipts.setError(uploadMessage(failed));
            else toast.success("Comprobante enviado. Finanzas lo verá al revisar tu pago.");
        } catch (cause) {
            receipts.setError((cause as Error).message);
        } finally {
            setSubmitting(false);
            setUploadProgress(null);
        }
    }

    function downloadQr() {
        const canvas = qrRef.current;
        if (!canvas || !current) return;
        const link = document.createElement("a");
        link.href = canvas.toDataURL("image/png");
        link.download = `recarga-${shortTopUpReference(current.id)}.png`;
        link.click();
    }

    async function shareInstructions() {
        if (!current) return;
        const text = topUpInstructionsText({
            amountLabel: formatMoney(Number(current.amount), current.currency),
            reference: shortTopUpReference(current.id),
            key: current.action?.key,
            expiresLabel: formatDateTime(current.expires_at),
        });
        if (typeof navigator.share === "function") {
            try {
                await navigator.share({ title: "Recarga de saldo Vercode", text });
                return;
            } catch {
                // Cancelled or unavailable: fall back to the clipboard.
            }
        }
        await navigator.clipboard.writeText(text);
        toast.success("Instrucciones copiadas. Compártelas con quien hará el pago.");
    }

    const remaining = current ? timeRemaining(current.expires_at, now) : null;
    const errorBlock = error ? (
        <p role="alert" className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" aria-hidden="true" /> {error}
        </p>
    ) : null;

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                onOpenChange(next);
                if (!next && step !== "pay") reset();
            }}
        >
            <DialogContent
                className="max-h-[calc(100dvh-1.5rem)] gap-0 overflow-y-auto p-0 sm:max-w-2xl"
                onOpenAutoFocus={(event) => event.preventDefault()}
            >
                <div className="sticky top-0 z-10 border-b bg-background px-6 pb-4 pt-6">
                    <Stepper current={step} />
                </div>

                {step === "amount" ? (
                    <div className="space-y-5 px-6 py-5">
                        <DialogHeader className="text-left">
                            <DialogTitle ref={titleRef} tabIndex={-1} className="outline-none">¿Cuánto quieres recargar?</DialogTitle>
                            <DialogDescription>
                                Transfieres por Bre-B desde tu banco y el saldo se suma cuando finanzas confirma el pago.
                            </DialogDescription>
                        </DialogHeader>

                        {resumable ? (
                            <button
                                type="button"
                                onClick={() => {
                                    setTopUp(resumable);
                                    setStep("pay");
                                }}
                                className="flex w-full items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-left text-sm text-amber-900 transition-colors hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
                            >
                                <span>
                                    Tienes una recarga sin pagar de{" "}
                                    <strong className="tabular-nums">{formatMoney(Number(resumable.amount), resumable.currency)}</strong>
                                </span>
                                <span className="inline-flex items-center gap-1 font-medium">
                                    Continuar <ArrowRight className="size-4" aria-hidden="true" />
                                </span>
                            </button>
                        ) : null}

                        <div className="grid gap-5 md:grid-cols-[1fr_15rem]">
                            <div className="space-y-3">
                                <Label htmlFor="topup-amount">Monto</Label>
                                <div className="relative">
                                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-2xl font-semibold text-muted-foreground">$</span>
                                    <Input
                                        id="topup-amount"
                                        inputMode="numeric"
                                        autoComplete="off"
                                        autoFocus
                                        placeholder="500.000"
                                        className="h-14 pl-8 text-2xl font-semibold tabular-nums"
                                        value={amountInput ? Number(amountInput).toLocaleString("es-CO") : ""}
                                        onChange={(event) => setAmountInput(event.target.value.replace(/[^\d]/g, ""))}
                                        aria-invalid={amountInput !== "" && !validation.ok}
                                        aria-describedby="topup-amount-help"
                                    />
                                </div>
                                <p
                                    id="topup-amount-help"
                                    className={cn("text-xs", amountInput !== "" && !validation.ok ? "text-destructive" : "text-muted-foreground")}
                                >
                                    {amountInput !== "" && !validation.ok
                                        ? validation.error
                                        : `Entre ${formatMoney(TOPUP_MIN_COP, "COP")} y ${formatMoney(BREB_MAX_PER_TRANSACTION_COP, "COP")} por transferencia.`}
                                </p>
                                <div className="flex flex-wrap gap-2" role="group" aria-label="Montos sugeridos">
                                    {settle ? (
                                        <Button
                                            type="button"
                                            variant={Number(amountInput) === settle ? "default" : "outline"}
                                            size="sm"
                                            className="rounded-full border-red-300 dark:border-red-800"
                                            onClick={() => setAmountInput(String(settle))}
                                        >
                                            Pagar pendiente · {formatMoney(settle, "COP")}
                                        </Button>
                                    ) : null}
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
                            </div>

                            <div className="rounded-xl border bg-muted/30 p-4" aria-live="polite">
                                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tu saldo</p>
                                <p className={cn("mt-1 text-lg font-semibold tabular-nums", BALANCE_TONE_CLASS[balancePresentation(balance).tone])}>
                                    {balance < 0 ? "−" : ""}
                                    {formatMoney(Math.abs(balance), currency)}
                                </p>
                                <p className="text-xs text-muted-foreground">{balancePresentation(balance).label}</p>
                                {preview ? (
                                    <div className="mt-3 border-t pt-3">
                                        <p className="text-xs text-muted-foreground">Después de acreditar</p>
                                        <p className={cn("text-lg font-semibold tabular-nums", BALANCE_TONE_CLASS[balancePresentation(preview.after).tone])}>
                                            {preview.after < 0 ? "−" : ""}
                                            {formatMoney(Math.abs(preview.after), currency)}
                                        </p>
                                        {preview.debtCovered > 0 ? (
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                {preview.remainingDebt === 0
                                                    ? "Cubre todo lo pendiente."
                                                    : `Cubre ${formatMoney(preview.debtCovered, currency)} de lo pendiente.`}
                                            </p>
                                        ) : null}
                                    </div>
                                ) : null}
                            </div>
                        </div>

                        <details className="group rounded-lg border px-4 py-3 text-sm">
                            <summary className="flex cursor-pointer list-none items-center gap-2 font-medium">
                                <Info className="size-4 text-muted-foreground" aria-hidden="true" />
                                ¿Cómo funciona la recarga?
                            </summary>
                            <ol className="mt-3 list-decimal space-y-1 pl-5 text-muted-foreground">
                                <li>Te mostramos el QR y la llave Bre-B, con el monto y una referencia.</li>
                                <li>Transfieres desde la app de tu banco y escribes la referencia en la descripción.</li>
                                <li>Nos confirmas el número que te dio tu banco y finanzas verifica el pago.</li>
                            </ol>
                        </details>

                        <label className="flex items-start gap-3 text-sm">
                            <Checkbox
                                checked={accepted}
                                onCheckedChange={(value) => setAccepted(value === true)}
                                aria-label="Acepto las condiciones de la recarga"
                                className="mt-0.5"
                            />
                            <span className="text-muted-foreground">
                                Pagaré el monto exacto con la referencia indicada. Entiendo que el saldo se acredita cuando
                                finanzas confirma la transferencia.
                            </span>
                        </label>

                        {errorBlock}
                        <DialogFooter>
                            <Button size="lg" onClick={createTopUp} disabled={!validation.ok || !accepted || submitting}>
                                {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                                Continuar al pago
                                <ArrowRight className="size-4" aria-hidden="true" />
                            </Button>
                        </DialogFooter>
                    </div>
                ) : null}

                {step === "pay" && current ? (
                    <div className="space-y-5 px-6 py-5">
                        <DialogHeader className="text-left">
                            <DialogTitle ref={titleRef} tabIndex={-1} className="outline-none">Transfiere con Bre-B</DialogTitle>
                            <DialogDescription>
                                Escanea el código desde la app de tu banco o usa la llave. Paga el monto exacto y escribe la
                                referencia en la descripción.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-5 md:grid-cols-[auto_1fr]">
                            {current.action?.kind === "display_qr" && current.action.qr_payload ? (
                                <div className="order-2 flex flex-col items-center gap-2 md:order-1">
                                    <div className="rounded-2xl border bg-white p-4 shadow-sm">
                                        <QRCodeCanvas
                                            ref={qrRef}
                                            value={current.action.qr_payload}
                                            size={196}
                                            marginSize={1}
                                            role="img"
                                            aria-label="Código QR Bre-B para pagar"
                                        />
                                    </div>
                                    <Button type="button" variant="ghost" size="sm" onClick={downloadQr}>
                                        <Download className="size-4" aria-hidden="true" /> Descargar QR
                                    </Button>
                                </div>
                            ) : null}
                            <div className="order-1 space-y-2 md:order-2">
                                <CopyField label="Monto exacto" value={formatMoney(Number(current.amount), current.currency)} emphasis />
                                <CopyField label="Referencia para la descripción" value={shortTopUpReference(current.id)} mono />
                                {current.action?.key ? <CopyField label="Llave Bre-B" value={current.action.key} mono /> : null}
                                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                                    {remaining ? (
                                        <span
                                            className={cn(
                                                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                                                remaining.urgent
                                                    ? "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200"
                                                    : "bg-muted text-muted-foreground",
                                            )}
                                        >
                                            <Clock className="size-3.5" aria-hidden="true" />
                                            {remaining.expired ? "Plazo vencido" : `Vence en ${remaining.label}`}
                                        </span>
                                    ) : null}
                                    <Button type="button" variant="outline" size="sm" onClick={shareInstructions}>
                                        <Share2 className="size-4" aria-hidden="true" /> Enviar instrucciones
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2 rounded-xl border bg-muted/20 p-4">
                            <Label htmlFor="topup-bank-ref">¿Ya transferiste? Escribe la referencia de tu banco</Label>
                            <Input
                                id="topup-bank-ref"
                                autoComplete="off"
                                placeholder="Número de aprobación o de transacción"
                                value={bankReference}
                                onChange={(event) => setBankReference(event.target.value)}
                                aria-describedby="topup-bank-ref-help"
                            />
                            <p id="topup-bank-ref-help" className="text-xs text-muted-foreground">
                                Aparece en el comprobante de la transferencia. Con ella finanzas encuentra tu pago.
                            </p>
                            <div className="pt-2">
                                <ReceiptPicker state={receipts} disabled={submitting} progress={uploadProgress} />
                            </div>
                        </div>

                        {errorBlock}
                        <DialogFooter className="gap-2 sm:justify-between">
                            <Button variant="ghost" onClick={() => onOpenChange(false)}>
                                Pagar más tarde
                            </Button>
                            <Button
                                size="lg"
                                onClick={reportPayment}
                                disabled={
                                    bankReference.trim().length < 3
                                    || submitting
                                    || receipts.preparing
                                    || Boolean(remaining?.expired)
                                }
                            >
                                {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                                Ya hice la transferencia
                            </Button>
                        </DialogFooter>
                    </div>
                ) : null}

                {step === "status" && current ? (
                    <div className="space-y-5 px-6 py-5">
                        <DialogHeader className="text-left">
                            <DialogTitle ref={titleRef} tabIndex={-1} className="outline-none">{topUpStatePresentation(current.state).label}</DialogTitle>
                            <DialogDescription>{topUpStatePresentation(current.state).description}</DialogDescription>
                        </DialogHeader>

                        <div className="flex items-baseline justify-between rounded-xl border bg-muted/20 px-4 py-3">
                            <span className="font-mono text-sm text-muted-foreground">{shortTopUpReference(current.id)}</span>
                            <span className="text-2xl font-bold tabular-nums">
                                {formatMoney(Number(current.amount), current.currency)}
                            </span>
                        </div>

                        <ol className="space-y-0" aria-live="polite" aria-label="Estado de la recarga">
                            {topUpTimeline(current).map((item, index, all) => (
                                <li key={item.key} className="flex gap-3">
                                    <div className="flex flex-col items-center">
                                        <TimelineIcon status={item.status} />
                                        {index < all.length - 1 ? (
                                            <span
                                                className={cn("my-1 w-px flex-1", item.status === "done" ? "bg-emerald-500" : "bg-border")}
                                                aria-hidden="true"
                                            />
                                        ) : null}
                                    </div>
                                    <div className="pb-4">
                                        <p className={cn("text-sm font-medium", item.status === "upcoming" && "text-muted-foreground")}>
                                            {item.label}
                                        </p>
                                        {item.at ? (
                                            <p className="text-xs text-muted-foreground">{formatDateTime(item.at)}</p>
                                        ) : item.status === "current" && item.key === "review" ? (
                                            <p className="text-xs text-muted-foreground">
                                                Normalmente en menos de una hora hábil.
                                            </p>
                                        ) : null}
                                    </div>
                                </li>
                            ))}
                        </ol>

                        {receiptNotice ? (
                            <p role="status" className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {receiptNotice}
                            </p>
                        ) : null}
                        {current.state === "under_review" ? (
                            <section aria-labelledby="topup-receipts-title" className="space-y-3 rounded-xl border p-4">
                                <div className="flex items-center justify-between gap-2">
                                    <h3 id="topup-receipts-title" className="text-sm font-medium">Comprobante</h3>
                                    <span className="text-xs text-muted-foreground">{evidenceCountLabel(attachedCount)}</span>
                                </div>
                                {attachedCount < EVIDENCE_MAX_FILES ? (
                                    <>
                                        <p className="text-xs text-muted-foreground">
                                            {attachedCount === 0
                                                ? "Si lo adjuntas, finanzas encuentra y confirma tu pago más rápido."
                                                : "Puedes agregar otro si hace falta."}
                                        </p>
                                        <ReceiptPicker state={receipts} disabled={submitting} progress={uploadProgress} />
                                        {receipts.receipts.length > 0 ? (
                                            <Button
                                                size="lg"
                                                className="w-full sm:w-auto"
                                                onClick={attachReceipts}
                                                disabled={submitting || receipts.preparing}
                                            >
                                                {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                                                Enviar comprobante
                                            </Button>
                                        ) : null}
                                    </>
                                ) : null}
                            </section>
                        ) : null}
                        {current.state === "under_review" ? (
                            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                                <p className="font-medium">No tienes que esperar para comprar.</p>
                                <p className="mt-0.5 text-xs">
                                    Puedes hacer tus compras ahora. El saldo se actualiza solo cuando finanzas confirme el pago.
                                </p>
                            </div>
                        ) : null}
                        {topUpStatePresentation(current.state).isOpen ? (
                            <p className="text-xs text-muted-foreground">
                                Puedes cerrar esta ventana: te avisaremos en el indicador de saldo cuando se acredite.
                            </p>
                        ) : null}
                        <DialogFooter className="gap-2 sm:justify-between">
                            <Button asChild variant="ghost">
                                <Link href="/wallet#recargas" onClick={() => onOpenChange(false)}>
                                    Ver mis recargas
                                </Link>
                            </Button>
                            <Button onClick={() => onOpenChange(false)}>Listo</Button>
                        </DialogFooter>
                    </div>
                ) : null}
            </DialogContent>
        </Dialog>
    );
}
