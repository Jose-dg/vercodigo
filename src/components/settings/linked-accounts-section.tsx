"use client";

import { useEffect, useState } from "react";
import { useReverification, useUser } from "@clerk/nextjs";
import { isClerkAPIResponseError, isReverificationCancelledError } from "@clerk/nextjs/errors";
import type { ExternalAccountResource, OAuthStrategy } from "@clerk/nextjs/types";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

import { LINKED_RETURN_PARAM } from "./params";

/**
 * Vincular Google o Apple a la cuenta. Es opcional: la contraseña nunca se quita, así
 * que siempre queda una forma de entrar (hay quien usa el teléfono de la empresa y no
 * quiere dejar su cuenta personal en él). Se usa un componente propio y no
 * <UserProfile />, porque ese también deja cambiar correo y contraseña directo en
 * Clerk, sin pasar por nuestra base.
 */

type Provider = {
    provider: "google" | "apple";
    strategy: OAuthStrategy;
    label: string;
    Icon: () => React.ReactElement;
};

const PROVIDERS: Provider[] = [
    { provider: "google", strategy: "oauth_google", label: "Google", Icon: GoogleIcon },
    { provider: "apple", strategy: "oauth_apple", label: "Apple", Icon: AppleIcon },
];

const RETURN_PARAM = LINKED_RETURN_PARAM;

const ERROR_MESSAGES: Record<string, string> = {
    external_account_exists: "Esa cuenta ya está vinculada a otro usuario del portal.",
    oauth_access_denied: "No se dio permiso en la ventana del proveedor.",
    not_allowed_access: "Esa cuenta no tiene permiso para entrar al portal.",
};

function errorMessage(error: unknown, fallback: string): string {
    if (isClerkAPIResponseError(error)) {
        const first = error.errors[0];
        return ERROR_MESSAGES[first?.code ?? ""] ?? first?.longMessage ?? first?.message ?? fallback;
    }
    return fallback;
}

function isVerified(account: ExternalAccountResource) {
    return account.verification?.status === "verified";
}

export function LinkedAccountsSection() {
    const { user, isLoaded } = useUser();
    const [busy, setBusy] = useState<Provider["provider"] | null>(null);
    const [confirming, setConfirming] = useState<{ provider: Provider; account: ExternalAccountResource } | null>(null);

    // Clerk pide confirmar la identidad (clave o código) antes de estos cambios si la
    // sesión no es reciente; useReverification muestra ese paso y reintenta.
    const createAccount = useReverification((strategy: OAuthStrategy, redirectUrl: string) =>
        user!.createExternalAccount({ strategy, redirectUrl }),
    );
    const destroyAccount = useReverification((account: ExternalAccountResource) => account.destroy());

    // Resultado al volver de la ventana del proveedor.
    useEffect(() => {
        if (!isLoaded || !user) return;
        const url = new URL(window.location.href);
        const returned = url.searchParams.get(RETURN_PARAM);
        if (!returned) return;
        url.searchParams.delete(RETURN_PARAM);
        window.history.replaceState(null, "", url.pathname + url.search + url.hash);

        const provider = PROVIDERS.find((p) => p.provider === returned);
        const account = user.externalAccounts.find((a) => a.provider === returned);
        if (!provider) return;
        if (account && isVerified(account)) {
            toast.success(`${provider.label} vinculada. Ya puedes entrar con ella.`);
        } else {
            const code = account?.verification?.error?.code ?? "";
            toast.error(ERROR_MESSAGES[code] ?? account?.verification?.error?.longMessage ?? `No se completó la vinculación con ${provider.label}.`);
        }
    }, [isLoaded, user]);

    async function connect(provider: Provider) {
        if (!user) return;
        setBusy(provider.provider);
        try {
            // Un intento anterior sin terminar bloquea uno nuevo con el mismo proveedor.
            const stale = user.externalAccounts.find((a) => a.provider === provider.provider && !isVerified(a));
            if (stale) await destroyAccount(stale);

            const redirectUrl = new URL(window.location.href);
            redirectUrl.searchParams.set(RETURN_PARAM, provider.provider);
            const account = await createAccount(provider.strategy, redirectUrl.toString());
            const next = account?.verification?.externalVerificationRedirectURL;
            if (!next) throw new Error("sin redirección");
            window.location.assign(next.href);
        } catch (error) {
            setBusy(null);
            if (isReverificationCancelledError(error)) return;
            toast.error(errorMessage(error, `No se pudo vincular ${provider.label}. Intenta de nuevo.`));
        }
    }

    async function disconnect() {
        if (!confirming) return;
        const { provider, account } = confirming;
        setBusy(provider.provider);
        try {
            await destroyAccount(account);
            await user?.reload();
            toast.success(`${provider.label} desvinculada. Sigues entrando con tu correo y contraseña.`);
            setConfirming(null);
        } catch (error) {
            if (!isReverificationCancelledError(error)) {
                toast.error(errorMessage(error, `No se pudo desvincular ${provider.label}. Intenta de nuevo.`));
            }
        } finally {
            setBusy(null);
        }
    }

    return (
        <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
                Opcional. Entra con un toque desde tu Google o Apple. Tu correo y contraseña siguen funcionando.
            </p>
            <ul className="divide-y rounded-lg border">
                {PROVIDERS.map((provider) => {
                    const account = user?.externalAccounts.find((a) => a.provider === provider.provider && isVerified(a));
                    const isBusy = busy === provider.provider;
                    return (
                        <li key={provider.provider} className="flex items-center gap-3 p-3">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-background">
                                <provider.Icon />
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium">{provider.label}</p>
                                {!isLoaded ? (
                                    <Skeleton className="mt-1 h-3 w-32" />
                                ) : (
                                    <p className="truncate text-xs text-muted-foreground">
                                        {account ? `Vinculada como ${account.emailAddress || account.accountIdentifier()}` : "No vinculada"}
                                    </p>
                                )}
                            </div>
                            {isLoaded && (
                                account ? (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={busy !== null}
                                        onClick={() => setConfirming({ provider, account })}
                                    >
                                        Desvincular
                                    </Button>
                                ) : (
                                    <Button size="sm" disabled={busy !== null} onClick={() => connect(provider)}>
                                        {isBusy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                                        {isBusy ? "Abriendo…" : "Vincular"}
                                    </Button>
                                )
                            )}
                        </li>
                    );
                })}
            </ul>

            <Dialog open={confirming !== null} onOpenChange={(open) => !open && busy === null && setConfirming(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>¿Desvincular {confirming?.provider.label}?</DialogTitle>
                        <DialogDescription>
                            Ya no podrás entrar con {confirming?.account.emailAddress || confirming?.provider.label}. Sigues
                            entrando con tu correo y contraseña, y puedes vincularla otra vez cuando quieras.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" disabled={busy !== null} onClick={() => setConfirming(null)}>
                            Cancelar
                        </Button>
                        <Button variant="destructive" disabled={busy !== null} onClick={disconnect}>
                            {busy !== null && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                            Desvincular
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function GoogleIcon() {
    return (
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
            <path fill="#4285F4" d="M23.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.45a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.57-5.17 3.57-8.65Z" />
            <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.9l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.1A12 12 0 0 0 12 24Z" />
            <path fill="#FBBC05" d="M5.29 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.28a12 12 0 0 0 0 10.8l4.01-3.1Z" />
            <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.6 4.59 1.8l3.44-3.44A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.28 6.6l4.01 3.1C6.23 6.86 8.88 4.75 12 4.75Z" />
        </svg>
    );
}

function AppleIcon() {
    return (
        <svg viewBox="0 0 24 24" className="size-5 fill-foreground" aria-hidden="true">
            <path d="M16.37 12.7c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.09-2.01-3.76-2.04-1.6-.16-3.12.94-3.93.94-.81 0-2.06-.92-3.39-.89A5.02 5.02 0 0 0 3.27 9.4c-1.81 3.14-.46 7.78 1.3 10.33.86 1.25 1.89 2.65 3.23 2.6 1.3-.05 1.79-.84 3.36-.84 1.57 0 2.01.84 3.38.81 1.4-.02 2.28-1.27 3.13-2.52a11 11 0 0 0 1.42-2.92 4.5 4.5 0 0 1-2.72-4.16ZM13.79 5.07a4.5 4.5 0 0 0 1.06-3.27 4.6 4.6 0 0 0-3.01 1.56 4.3 4.3 0 0 0-1.09 3.15 3.8 3.8 0 0 0 3.04-1.44Z" />
        </svg>
    );
}
