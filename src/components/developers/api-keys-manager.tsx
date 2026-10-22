'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, KeyRound, Loader2, Plus, TriangleAlert } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type ApiKeyRow = {
    id: string;
    name: string;
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

export function ApiKeysManager({
    isPlatform,
    canCreate,
    scopes,
}: {
    isPlatform: boolean;
    canCreate: boolean;
    scopes: ScopeOption[];
}) {
    const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
    const [companyId, setCompanyId] = useState('');
    const [rows, setRows] = useState<ApiKeyRow[] | null>(null);
    const [createOpen, setCreateOpen] = useState(false);
    // A new key per opening remounts the form, so it always starts empty.
    const [createSession, setCreateSession] = useState(0);
    const [revoking, setRevoking] = useState<ApiKeyRow | null>(null);
    const [busy, setBusy] = useState(false);
    const [createdKey, setCreatedKey] = useState<string | null>(null);

    useEffect(() => {
        if (!isPlatform) return;
        fetch('/api/companies')
            .then((response) => (response.ok ? response.json() : []))
            .then((list) => setCompanies(Array.isArray(list) ? list : []))
            .catch(() => undefined);
    }, [isPlatform]);

    const load = useCallback(async () => {
        if (isPlatform && !companyId) {
            setRows([]);
            return;
        }
        setRows(null);
        const query = isPlatform ? `?companyId=${encodeURIComponent(companyId)}` : '';
        const response = await fetch(`/api/api-keys${query}`, { cache: 'no-store' });
        if (!response.ok) {
            toast.error(await readError(response, 'No se pudieron cargar las API keys'));
            setRows([]);
            return;
        }
        setRows((await response.json()).apiKeys);
    }, [isPlatform, companyId]);

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

    const activeCount = rows?.filter((row) => row.status === 'active').length ?? 0;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                {isPlatform ? (
                    <Select value={companyId} onValueChange={setCompanyId}>
                        <SelectTrigger className="w-72">
                            <SelectValue placeholder="Elige una compañía" />
                        </SelectTrigger>
                        <SelectContent>
                            {companies.map((company) => (
                                <SelectItem key={company.id} value={company.id}>
                                    {company.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                ) : (
                    <p className="text-sm text-muted-foreground">
                        {rows ? `${activeCount} activa(s)` : ' '}
                    </p>
                )}
                {canCreate && (
                    <Button
                        onClick={() => {
                            setCreateSession((session) => session + 1);
                            setCreateOpen(true);
                        }}
                    >
                        <Plus className="mr-2 size-4" />
                        Crear API key
                    </Button>
                )}
            </div>
            {isPlatform && (
                <p className="text-xs text-muted-foreground">
                    Como plataforma puedes ver y revocar keys. Crearlas le corresponde a la compañía, porque la key actúa en
                    nombre de quien la crea.
                </p>
            )}

            <div className="overflow-x-auto rounded-xl border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nombre</TableHead>
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
                                <TableCell colSpan={7}>
                                    <Skeleton className="h-8 w-full" />
                                </TableCell>
                            </TableRow>
                        ) : rows.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                                    {isPlatform && !companyId ? 'Elige una compañía.' : 'Todavía no hay API keys.'}
                                </TableCell>
                            </TableRow>
                        ) : (
                            rows.map((row) => (
                                <TableRow key={row.id} className={row.status === 'active' ? '' : 'opacity-60'}>
                                    <TableCell className="font-medium">{row.name}</TableCell>
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
                onCreated={(key) => {
                    setCreateOpen(false);
                    setCreatedKey(key);
                    void load();
                }}
            />
            <RevealKeyDialog key={createdKey ?? 'none'} apiKey={createdKey} onClose={() => setCreatedKey(null)} />

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
    onCreated: (key: string) => void;
}) {
    const [name, setName] = useState('');
    const [selected, setSelected] = useState<string[]>(scopes.map((scope) => scope.value));
    const [saving, setSaving] = useState(false);

    const submit = async () => {
        setSaving(true);
        try {
            const response = await fetch('/api/api-keys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, scopes: selected }),
            });
            if (!response.ok) {
                toast.error(await readError(response, 'No se pudo crear la API key'));
                return;
            }
            onCreated((await response.json()).key);
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
                    <Button onClick={submit} disabled={saving || !name.trim() || selected.length === 0}>
                        {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
                        Crear
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/** The only moment the key is visible. Closing requires confirming it was saved. */
function RevealKeyDialog({ apiKey, onClose }: { apiKey: string | null; onClose: () => void }) {
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
                    <DialogDescription>Cópiala y guárdala en un lugar seguro de tu servidor.</DialogDescription>
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
