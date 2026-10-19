"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, Eye, EyeOff, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_ISSUE_LABELS, passwordIssues, type PasswordIssue } from "@/modules/identity/domain";
import { useUser } from "@clerk/nextjs";

const ALL_ISSUES: PasswordIssue[] = ["too_short", "contains_email"];

export function PasswordSection() {
    const router = useRouter();
    const { user: clerkUser } = useUser();
    const email = clerkUser?.primaryEmailAddress?.emailAddress ?? null;
    const [current, setCurrent] = useState("");
    const [next, setNext] = useState("");
    const [confirm, setConfirm] = useState("");
    const [show, setShow] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const issues = passwordIssues(next, email);
    const matches = next.length > 0 && next === confirm;
    const canSubmit = current.length > 0 && next.length > 0 && issues.length === 0 && matches && !saving;

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!canSubmit) return;
        setSaving(true);
        setError(null);
        try {
            const response = await fetch("/api/account/password", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ currentPassword: current, newPassword: next }),
            });
            const body = await response.json().catch(() => null);
            if (!response.ok) {
                setError(body?.message ?? "No se pudo cambiar la contraseña");
                return;
            }
            toast.success("Contraseña actualizada. Cerramos tus sesiones en otros dispositivos.");
            setCurrent("");
            setNext("");
            setConfirm("");
            // Recarga el layout del servidor para que desaparezca el aviso de cambiar la clave.
            router.refresh();
        } catch {
            setError("No se pudo cambiar la contraseña. Intenta de nuevo.");
        } finally {
            setSaving(false);
        }
    }

    const type = show ? "text" : "password";

    return (
        <form className="space-y-4" onSubmit={submit}>
            <p className="text-sm text-muted-foreground">
                Elige una contraseña tuya. Al guardarla se cierran las sesiones abiertas en otros dispositivos.
            </p>
            {/* Campo oculto con el usuario: ayuda al gestor de contraseñas a asociarla. */}
            <input type="email" name="username" autoComplete="username" value={email ?? ""} readOnly hidden />
            <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                    <Label htmlFor="current-password">Contraseña actual</Label>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1.5 px-2 text-xs text-muted-foreground"
                        aria-pressed={show}
                        onClick={() => setShow((v) => !v)}
                    >
                        {show ? <EyeOff className="size-3.5" aria-hidden="true" /> : <Eye className="size-3.5" aria-hidden="true" />}
                        {show ? "Ocultar" : "Mostrar"}
                    </Button>
                </div>
                <Input id="current-password" type={type} autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} disabled={saving} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                    <Label htmlFor="new-password">Nueva contraseña</Label>
                    <Input id="new-password" type={type} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} disabled={saving} />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="confirm-password">Confírmala</Label>
                    <Input id="confirm-password" type={type} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={saving} aria-invalid={confirm.length > 0 && !matches} />
                </div>
            </div>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-live="polite">
                {ALL_ISSUES.map((issue) => {
                    const ok = next.length > 0 && !issues.includes(issue);
                    return (
                        <li key={issue} className={ok ? "flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400" : "flex items-center gap-1.5 text-muted-foreground"}>
                            {ok ? <Check className="size-3.5" aria-hidden="true" /> : <X className="size-3.5" aria-hidden="true" />}
                            {PASSWORD_ISSUE_LABELS[issue]}
                        </li>
                    );
                })}
                <li className={matches ? "flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400" : "flex items-center gap-1.5 text-muted-foreground"}>
                    {matches ? <Check className="size-3.5" aria-hidden="true" /> : <X className="size-3.5" aria-hidden="true" />}
                    Las dos coinciden
                </li>
            </ul>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end">
                <Button type="submit" className="w-full sm:w-auto" disabled={!canSubmit}>
                    {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                    {saving ? "Guardando…" : "Guardar contraseña"}
                </Button>
            </div>
        </form>
    );
}
