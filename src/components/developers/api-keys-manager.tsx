'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, FlaskConical, KeyRound, Loader2, Plus, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type Environment = 'LIVE' | 'SANDBOX';

type ApiKeyRow = {
    id: string;
    name: string;
    environment: Environment;
    displayKey: string;
    scopes: string[];
    createdAt: string;
    createdBy: string;
    lastUsedAt: string | null;
    expiresAt: string | null;
    revokedAt: string | null;
    status: 'active' | 'revoked' | 'expired';
};

type ScopeOption = { value: string; label: string };

const STATUS_LABEL: Record<ApiKeyRow['status'], string> = { active: 'Activa', revoked: 'Revocada', expired: 'Vencida' };

const when = (value: string | null) =>
    value
        ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
        : '—';

async function readError(response: Response, fallback: string) {
    const data = await response.json().catch(() => null);
    return (typeof data?.message === 'string' && data.message) || fallback;
}

function EnvironmentBadge({ environment }: { environment: Environment }) {
    return environment === 'SANDBOX' ? (
        <Badge variant="outline" className="gap-1 border-sky-300 text-sky-700 dark:border-sky-800 dark:text-sky-300">
            <FlaskConical className="size-3" />
            Sandbox
        </Badge>
    ) : (
        <Badge variant="outline" className="border-amber-300 text-amber-800 dark:border-amber-800 dark:text-amber-300">
            Producción
        </Badge>
    );
}

/** Keys of the signed-in OWNER/GENERAL_ADMIN's own company. */
export function ApiKeysManager({ scopes }: { scopes: ScopeOption[] }) {
    const [rows, setRows] = useState<ApiKeyRow[] | null>(null);
    const [createOpen, setCreateOpen] = useState(false);
    // A new key per opening remounts the form, so it always starts empty.
    const [createSession, setCreateSession] = useState(0);
    const [revoking, setRevoking] = useState<ApiKeyRow | null>(null);
    const [busy, setBusy] = useState(false);
    const [created, setCreated] = useState<{ key: string; environment: Environment } | null>(null);

    const load = useCallback(async () => {
        setRows(null);
        const response = await fetch('/api/api-keys', { cache: 'no-store' });
        if (!response.ok) {
            toast.error(await readError(response, 'No se pudieron cargar las API keys'));
            setRows([]);
            return;
        }
        setRows((await response.json()).apiKeys);
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const revoke = async () => {
        if (!revoking) return;
        setBusy(true);
        try {
            const response = await fetch(`/api/api-keys/${revoking.id}`, { method: 'DELETE' });
            if (!response.ok) {
                toast.error(await readError(response, 'No se pudo revocar la key'));
                return;
            }
            toast.success('API key revocada. Las peticiones con ella fallarán desde ahora.');
            setRevoking(null);
            await load();
        } finally {
            setBusy(false);
        }
    };

    const activeCount = (environment: Environment) =>
        rows?.filter((row) => row.status === 'active' && row.environment === environment).length ?? 0;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                    {rows ? `${activeCount('SANDBOX')} sandbox · ${activeCount('LIVE')} producción` : ' '}
                </p>
                <Button
                    onClick={() => {
                        setCreateSession((session) => session + 1);
                        setCreateOpen(true);
                    }}
                >
                    <Plus className="mr-2 size-4" />
                    Crear API key
                </Button>
            </div>

            <div className="overflow-x-auto rounded-xl border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Ambiente</TableHead>
                            <TableHead>Key</TableHead>
                            <TableHead className="hidden md:table-cell">Permisos</TableHead>
                            <TableHead className="hidden lg:table-cell">Creada por</TableHead>
                            <TableHead className="hidden sm:table-cell">Último uso</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="w-0" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows === null ? (
                            <TableRow>
                                <TableCell colSpan={8}>
                                    <Skeleton className="h-8 w-full" />
                                </TableCell>
                            </TableRow>
                        ) : rows.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                                    Todavía no hay API keys. Empieza con una sandbox para probar sin cobros.
                                </TableCell>
                            </TableRow>
                        ) : (
                            rows.map((row) => (
                                <TableRow key={row.id} className={row.status === 'active' ? '' : 'opacity-60'}>
                                    <TableCell className="font-medium">{row.name}</TableCell>
                                    <TableCell>
                                        <EnvironmentBadge environment={row.environment} />
                                    </TableCell>
                                    <TableCell className="font-mono text-xs">{row.displayKey}</TableCell>
                                    <TableCell className="hidden md:table-cell">
                                        <div className="flex flex-wrap gap-1">
                                            {row.scopes.map((scope) => (
                                                <Badge key={scope} variant="outline" className="font-mono text-[11px] font-normal">
                                                    {scope}
                                                </Badge>
                                            ))}
                                        </div>
                                    </TableCell>
                                    <TableCell className="hidden text-sm lg:table-cell">
                                        {row.createdBy}
                                        <div className="text-xs text-muted-foreground">{when(row.createdAt)}</div>
                                    </TableCell>
                                    <TableCell className="hidden text-sm sm:table-cell">{when(row.lastUsedAt)}</TableCell>
                                    <TableCell>
                                        <Badge variant={row.status === 'active' ? 'default' : 'secondary'}>
                                            {STATUS_LABEL[row.status]}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {row.status === 'active' && (
                                            <Button variant="ghost" size="sm" onClick={() => setRevoking(row)}>
                                                Revocar
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <CreateApiKeyDialog
                key={createSession}
                open={createOpen}
                onOpenChange={setCreateOpen}
                scopes={scopes}
                onCreated={(result) => {
                    setCreateOpen(false);
                    setCreated(result);
                    void load();
                }}
            />
            <RevealKeyDialog key={created?.key ?? 'none'} created={created} onClose={() => setCreated(null)} />

            <Dialog open={revoking !== null} onOpenChange={(open) => !open && setRevoking(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>¿Revocar “{revoking?.name}”?</DialogTitle>
                        <DialogDescription>
                            Los sistemas que la usan dejarán de funcionar de inmediato. Esta acción no se puede deshacer.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRevoking(null)} disabled={busy}>
                            Cancelar
                        </Button>
                        <Button variant="destructive" onClick={revoke} disabled={busy}>
                            {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
                            Revocar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function CreateApiKeyDialog({
    open,
    onOpenChange,
    scopes,
    onCreated,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    scopes: ScopeOption[];
    onCreated: (created: { key: string; environment: Environment }) => void;
}) {
    const [environment, setEnvironment] = useState<Environment>('SANDBOX');
    // Production keys spend real money: creating one requires saying so explicitly.
    const [liveAcknowledged, setLiveAcknowledged] = useState(false);
    const [name, setName] = useState('');
    const [selected, setSelected] = useState<string[]>(scopes.map((scope) => scope.value));
    const [saving, setSaving] = useState(false);

    const submit = async () => {
        setSaving(true);
        try {
            const response = await fetch('/api/api-keys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, scopes: selected, environment }),
            });
            if (!response.ok) {
                toast.error(await readError(response, 'No se pudo crear la API key'));
                return;
            }
            onCreated({ key: (await response.json()).key, environment });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Crear API key</DialogTitle>
                    <DialogDescription>Ponle un nombre que identifique el sistema que la usará.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>Ambiente</Label>
                        <div className="grid gap-2 sm:grid-cols-2">
                            {([
                                ['SANDBOX', 'Sandbox', 'Para probar. Simula entregas: no cobra, no compra códigos y no envía emails.'],
                                ['LIVE', 'Producción', 'Compra de verdad: cada entrega se cobra de tu billetera y envía el código.'],
                            ] as const).map(([value, title, description]) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => {
                                        setEnvironment(value);
                                        setLiveAcknowledged(false);
                                    }}
                                    className={
                                        'rounded-xl border p-3 text-left text-sm transition-colors '
                                        + (environment === value ? 'border-primary bg-primary/5' : 'hover:bg-muted/50')
                                    }
                                    aria-pressed={environment === value}
                                >
                                    <span className="font-medium">{title}</span>
                                    <span className="mt-1 block text-xs text-muted-foreground">{description}</span>
                                </button>
                            ))}
                        </div>
                        {environment === 'LIVE' && (
                            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                                <Checkbox
                                    checked={liveAcknowledged}
                                    onCheckedChange={(checked) => setLiveAcknowledged(checked === true)}
                                    className="mt-0.5"
                                />
                                <span>
                                    Entiendo que esta key <strong>consume saldo real</strong> de la billetera: cada entrega
                                    creada con ella es dinero.
                                </span>
                            </label>
                        )}
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="api-key-name">Nombre</Label>
                        <Input
                            id="api-key-name"
                            placeholder="ERP producción"
                            maxLength={80}
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Permisos</Label>
                        {scopes.map((scope) => (
                            <label key={scope.value} className="flex cursor-pointer items-start gap-3 text-sm">
                                <Checkbox
                                    checked={selected.includes(scope.value)}
                                    onCheckedChange={(checked) =>
                                        setSelected((current) =>
                                            checked === true
                                                ? [...current, scope.value]
                                                : current.filter((value) => value !== scope.value),
                                        )
                                    }
                                    className="mt-0.5"
                                />
                                <span>
                                    {scope.label}
                                    <span className="ml-2 font-mono text-xs text-muted-foreground">{scope.value}</span>
                                </span>
                            </label>
                        ))}
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={submit}
                        disabled={
                            saving || !name.trim() || selected.length === 0 || (environment === 'LIVE' && !liveAcknowledged)
                        }
                    >
                        {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
                        Crear
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/** The only moment the key is visible. Closing requires confirming it was saved. */
function RevealKeyDialog({
    created,
    onClose,
}: {
    created: { key: string; environment: Environment } | null;
    onClose: () => void;
}) {
    const apiKey = created?.key ?? null;
    const [copied, setCopied] = useState(false);
    const [saved, setSaved] = useState(false);

    const copy = async () => {
        if (!apiKey) return;
        try {
            await navigator.clipboard.writeText(apiKey);
            setCopied(true);
        } catch {
            toast.error('No se pudo copiar. Selecciona la key y cópiala a mano.');
        }
    };

    return (
        <Dialog open={apiKey !== null} onOpenChange={(open) => !open && saved && onClose()}>
            <DialogContent onInteractOutside={(event) => event.preventDefault()}>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <KeyRound className="size-5" />
                        Tu nueva API key
                    </DialogTitle>
                    <DialogDescription>
                        {created?.environment === 'LIVE'
                            ? 'Key de producción: consume saldo real. Guárdala en un lugar seguro de tu servidor.'
                            : 'Key sandbox: úsala para probar, no cobra. Guárdala en un lugar seguro.'}
                    </DialogDescription>
                </DialogHeader>
                <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-3">
                    <code className="min-w-0 flex-1 select-all break-all font-mono text-xs">{apiKey}</code>
                    <Button size="sm" variant="outline" onClick={copy}>
                        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                    </Button>
                </div>
                <p className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-300">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                    No la volveremos a mostrar. Nadie en Diem puede recuperarla: si la pierdes, revócala y crea otra.
                </p>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox checked={saved} onCheckedChange={(checked) => setSaved(checked === true)} />
                    Ya la guardé
                </label>
                <DialogFooter>
                    <Button onClick={onClose} disabled={!saved}>
                        Listo
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
