"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRightLeft, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import { useCurrentUser } from "@/components/auth/ability-context";
import { isPlatformRole } from "@/lib/auth/abilities";
import { Badge } from "@/components/ui/badge";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface StoreOption {
    id: string;
    name: string;
    companyId: string;
    isActive: boolean;
}

interface CompanyOption {
    id: string;
    name: string;
}

interface CardPreview {
    uuid: string;
    product: string;
    storeId: string;
    storeName: string;
    companyId: string;
    companyName: string;
    isActivated: boolean;
    activationLock: boolean;
    canReassign: boolean;
    blockReason: string | null;
    denomination: { amount: number; currency: string } | null;
}

interface LookupResponse {
    requested: number;
    found: number;
    missing: string[];
    eligible: CardPreview[];
    blocked: CardPreview[];
    cards: CardPreview[];
}

interface ReassignResponse {
    success: boolean;
    count: number;
    targetStore: {
        id: string;
        name: string;
        companyId: string;
        companyName: string;
    };
    moved: Array<{
        uuid: string;
        product: string;
        fromStore: string;
        fromCompany: string;
        toStore: string;
        toCompany: string;
    }>;
}

function blockReasonLabel(reason: string | null): string {
    switch (reason) {
        case "already_activated":
            return "Ya activada";
        case "activation_lock":
            return "En activación";
        default:
            return "Disponible";
    }
}

export default function CardReassignPage() {
    const currentUser = useCurrentUser();
    const canReassign = currentUser ? isPlatformRole(currentUser.role) : false;

    const [stores, setStores] = useState<StoreOption[]>([]);
    const [companies, setCompanies] = useState<CompanyOption[]>([]);
    const [uuidInput, setUuidInput] = useState("");
    const [cards, setCards] = useState<CardPreview[]>([]);
    const [missing, setMissing] = useState<string[]>([]);
    const [selectedUuids, setSelectedUuids] = useState<Set<string>>(new Set());
    const [targetStoreId, setTargetStoreId] = useState("");
    const [lookupLoading, setLookupLoading] = useState(false);
    const [browseLoading, setBrowseLoading] = useState(false);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [lastResult, setLastResult] = useState<ReassignResponse | null>(null);

    const [browseStoreId, setBrowseStoreId] = useState("");
    const [browseSearch, setBrowseSearch] = useState("");
    const [browsePage, setBrowsePage] = useState(1);
    const [browseTotalPages, setBrowseTotalPages] = useState(1);
    const [browseRows, setBrowseRows] = useState<CardPreview[]>([]);

    useEffect(() => {
        if (!canReassign) return;
        Promise.all([
            fetch("/api/stores").then((res) => res.json()),
            fetch("/api/companies").then((res) => res.json()),
        ])
            .then(([storesData, companiesData]) => {
                if (Array.isArray(storesData)) {
                    setStores(
                        storesData
                            .filter((store: StoreOption) => store.isActive)
                            .map((store: StoreOption) => ({
                                id: store.id,
                                name: store.name,
                                companyId: store.companyId,
                                isActive: store.isActive,
                            })),
                    );
                }
                if (Array.isArray(companiesData)) {
                    setCompanies(
                        companiesData.map((company: CompanyOption) => ({
                            id: company.id,
                            name: company.name,
                        })),
                    );
                }
            })
            .catch(() => toast.error("No se pudieron cargar tiendas o compañías"));
    }, [canReassign]);

    const companyNameById = useMemo(() => {
        const map = new Map<string, string>();
        companies.forEach((company) => map.set(company.id, company.name));
        return map;
    }, [companies]);

    const storeOptions = useMemo(
        () =>
            [...stores].sort((a, b) => {
                const companyA = companyNameById.get(a.companyId) || "";
                const companyB = companyNameById.get(b.companyId) || "";
                return `${companyA} ${a.name}`.localeCompare(`${companyB} ${b.name}`, "es");
            }),
        [stores, companyNameById],
    );

    const selectedCards = useMemo(
        () => cards.filter((card) => selectedUuids.has(card.uuid)),
        [cards, selectedUuids],
    );

    const eligibleSelected = useMemo(
        () => selectedCards.filter((card) => card.canReassign),
        [selectedCards],
    );

    const targetStore = storeOptions.find((store) => store.id === targetStoreId);

    const applyLookupResult = (result: LookupResponse) => {
        setCards(result.cards);
        setMissing(result.missing);
        setSelectedUuids(new Set(result.eligible.map((card) => card.uuid)));
        if (result.missing.length) {
            toast.warning(`${result.missing.length} UUID no encontrados`);
        }
        if (result.blocked.length) {
            toast.warning(`${result.blocked.length} tarjetas bloqueadas para mover`);
        }
        if (result.eligible.length) {
            toast.success(`${result.eligible.length} tarjetas listas para remisión`);
        }
    };

    const lookupUuids = useCallback(async (values: string[]) => {
        setLookupLoading(true);
        try {
            const res = await fetch("/api/cards/lookup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ uuids: values }),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.message || "No se pudo validar las tarjetas");
            }
            applyLookupResult(data as LookupResponse);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Error validando tarjetas");
        } finally {
            setLookupLoading(false);
        }
    }, []);

    const handleValidatePaste = async () => {
        const values = uuidInput
            .split(/[\s,;]+/)
            .map((value) => value.trim())
            .filter(Boolean);
        if (!values.length) {
            toast.error("Pega al menos un UUID");
            return;
        }
        await lookupUuids(values);
    };

    const loadBrowsePage = async (page = browsePage) => {
        if (!browseStoreId) {
            toast.error("Selecciona una tienda origen");
            return;
        }
        setBrowseLoading(true);
        try {
            const params = new URLSearchParams({
                page: String(page),
                limit: "25",
                storeId: browseStoreId,
                isActivated: "false",
            });
            if (browseSearch.trim()) {
                params.set("search", browseSearch.trim());
            }
            const res = await fetch(`/api/cards?${params.toString()}`);
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.message || "No se pudo cargar el listado");
            }
            setBrowseRows(data.data || []);
            setBrowsePage(data.pagination?.page || page);
            setBrowseTotalPages(data.pagination?.pages || 1);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Error cargando tarjetas");
        } finally {
            setBrowseLoading(false);
        }
    };

    const mergeCardsIntoSelection = (incoming: CardPreview[]) => {
        setCards((prev) => {
            const map = new Map(prev.map((card) => [card.uuid, card]));
            incoming.forEach((card) => map.set(card.uuid, card));
            return [...map.values()];
        });
        setSelectedUuids((prev) => {
            const next = new Set(prev);
            incoming.filter((card) => card.canReassign).forEach((card) => next.add(card.uuid));
            return next;
        });
    };

    const toggleBrowseRow = (card: CardPreview, checked: boolean) => {
        mergeCardsIntoSelection([card]);
        setSelectedUuids((prev) => {
            const next = new Set(prev);
            if (checked && card.canReassign) {
                next.add(card.uuid);
            } else {
                next.delete(card.uuid);
            }
            return next;
        });
    };

    const toggleSelectedUuid = (uuid: string, checked: boolean) => {
        setSelectedUuids((prev) => {
            const next = new Set(prev);
            if (checked) next.add(uuid);
            else next.delete(uuid);
            return next;
        });
    };

    const handleReassign = async () => {
        if (!targetStoreId) {
            toast.error("Selecciona la tienda destino");
            return;
        }
        if (!eligibleSelected.length) {
            toast.error("No hay tarjetas elegibles seleccionadas");
            return;
        }

        setSubmitLoading(true);
        try {
            const res = await fetch("/api/cards/reassign", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    storeId: targetStoreId,
                    uuids: eligibleSelected.map((card) => card.uuid),
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.message || "No se pudo reasignar");
            }
            setLastResult(data as ReassignResponse);
            setConfirmOpen(false);
            toast.success(`Se movieron ${data.count} tarjeta(s) a ${data.targetStore.name}`);
            setCards((prev) => prev.filter((card) => !eligibleSelected.some((row) => row.uuid === card.uuid)));
            setSelectedUuids(new Set());
            setUuidInput("");
            if (browseStoreId) {
                await loadBrowsePage(browsePage);
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Error reasignando tarjetas");
        } finally {
            setSubmitLoading(false);
        }
    };

    if (!canReassign) {
        return (
            <div className="p-8">
                <p>No tienes permisos para remitir tarjetas entre tiendas.</p>
                <p className="mt-2 text-sm text-muted-foreground">
                    Esta operación está reservada a operadores de plataforma (SUPER_ADMIN / SYSTEM_ADMIN).
                </p>
            </div>
        );
    }

    return (
        <>
            <header className="flex h-16 shrink-0 items-center gap-2">
                <div className="flex items-center gap-2 px-4">
                    <SidebarTrigger className="-ml-1" />
                    <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
                    <Breadcrumb>
                        <BreadcrumbList>
                            <BreadcrumbItem className="hidden md:block">
                                <BreadcrumbLink asChild>
                                    <Link href="/">Inicio</Link>
                                </BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator className="hidden md:block" />
                            <BreadcrumbItem className="hidden md:block">
                                <BreadcrumbLink asChild>
                                    <Link href="/qr">Tarjetas</Link>
                                </BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator className="hidden md:block" />
                            <BreadcrumbItem>
                                <BreadcrumbPage>Remisión</BreadcrumbPage>
                            </BreadcrumbItem>
                        </BreadcrumbList>
                    </Breadcrumb>
                </div>
            </header>

            <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-bold tracking-tight">Remisión de tarjetas</h1>
                    <p className="text-muted-foreground max-w-3xl">
                        Mueve tarjetas físicas no activadas de una tienda a otra. Solo aplica a tarjetas
                        sin activación ni bloqueo en curso.
                    </p>
                </div>

                <Tabs defaultValue="paste" className="space-y-4">
                    <TabsList>
                        <TabsTrigger value="paste">Pegar UUIDs</TabsTrigger>
                        <TabsTrigger value="browse">Buscar en tienda</TabsTrigger>
                    </TabsList>

                    <TabsContent value="paste" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Lista de tarjetas</CardTitle>
                                <CardDescription>
                                    Pega códigos separados por coma, espacio o salto de línea (máx. 500).
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <textarea
                                    className="min-h-36 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    placeholder="FJ2ZSKXB, BZV2L2FQ, BUB7J53P"
                                    value={uuidInput}
                                    onChange={(event) => setUuidInput(event.target.value)}
                                />
                                <Button onClick={handleValidatePaste} disabled={lookupLoading}>
                                    {lookupLoading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Validando...
                                        </>
                                    ) : (
                                        <>
                                            <Search className="mr-2 h-4 w-4" />
                                            Validar tarjetas
                                        </>
                                    )}
                                </Button>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="browse" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Buscar en tienda origen</CardTitle>
                                <CardDescription>
                                    Lista tarjetas no activadas de una tienda y agrégalas a la remisión.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-4 md:grid-cols-3">
                                <div className="space-y-2 md:col-span-1">
                                    <Label>Tienda origen</Label>
                                    <Select value={browseStoreId} onValueChange={setBrowseStoreId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecciona tienda" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {storeOptions.map((store) => (
                                                <SelectItem key={store.id} value={store.id}>
                                                    {companyNameById.get(store.companyId) || "Compañía"} — {store.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2 md:col-span-1">
                                    <Label>Buscar UUID</Label>
                                    <Input
                                        value={browseSearch}
                                        onChange={(event) => setBrowseSearch(event.target.value)}
                                        placeholder="Prefijo o UUID completo"
                                    />
                                </div>
                                <div className="flex items-end md:col-span-1">
                                    <Button
                                        className="w-full"
                                        onClick={() => loadBrowsePage(1)}
                                        disabled={browseLoading}
                                    >
                                        {browseLoading ? "Cargando..." : "Buscar"}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        {browseRows.length > 0 && (
                            <Card>
                                <CardContent className="pt-6">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-12" />
                                                <TableHead>UUID</TableHead>
                                                <TableHead>Producto</TableHead>
                                                <TableHead>Estado</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {browseRows.map((card) => (
                                                <TableRow key={card.uuid}>
                                                    <TableCell>
                                                        <Checkbox
                                                            checked={selectedUuids.has(card.uuid)}
                                                            disabled={!card.canReassign}
                                                            onCheckedChange={(checked) =>
                                                                toggleBrowseRow(card, checked === true)
                                                            }
                                                        />
                                                    </TableCell>
                                                    <TableCell className="font-mono text-xs">{card.uuid}</TableCell>
                                                    <TableCell>{card.product}</TableCell>
                                                    <TableCell>
                                                        <Badge variant={card.canReassign ? "secondary" : "destructive"}>
                                                            {blockReasonLabel(card.blockReason)}
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                    <div className="mt-4 flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">
                                            Página {browsePage} de {browseTotalPages}
                                        </span>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled={browsePage <= 1 || browseLoading}
                                                onClick={() => loadBrowsePage(browsePage - 1)}
                                            >
                                                Anterior
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled={browsePage >= browseTotalPages || browseLoading}
                                                onClick={() => loadBrowsePage(browsePage + 1)}
                                            >
                                                Siguiente
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>
                </Tabs>

                {(cards.length > 0 || missing.length > 0) && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Resumen de selección</CardTitle>
                            <CardDescription>
                                {eligibleSelected.length} elegibles · {selectedCards.length - eligibleSelected.length} bloqueadas seleccionadas · {missing.length} no encontradas
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {missing.length > 0 && (
                                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                                    No encontradas: {missing.join(", ")}
                                </div>
                            )}
                            {cards.length > 0 && (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-12" />
                                            <TableHead>UUID</TableHead>
                                            <TableHead>Producto</TableHead>
                                            <TableHead>Origen</TableHead>
                                            <TableHead>Estado</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {cards.map((card) => (
                                            <TableRow key={card.uuid}>
                                                <TableCell>
                                                    <Checkbox
                                                        checked={selectedUuids.has(card.uuid)}
                                                        disabled={!card.canReassign}
                                                        onCheckedChange={(checked) =>
                                                            toggleSelectedUuid(card.uuid, checked === true)
                                                        }
                                                    />
                                                </TableCell>
                                                <TableCell className="font-mono text-xs">{card.uuid}</TableCell>
                                                <TableCell>{card.product}</TableCell>
                                                <TableCell>
                                                    {card.companyName} — {card.storeName}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={card.canReassign ? "secondary" : "destructive"}>
                                                        {blockReasonLabel(card.blockReason)}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                )}

                <Card>
                    <CardHeader>
                        <CardTitle>Destino</CardTitle>
                        <CardDescription>
                            Las tarjetas quedarán asignadas a esta tienda para activación y operación.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                        <div className="w-full md:max-w-md space-y-2">
                            <Label>Tienda destino</Label>
                            <Select value={targetStoreId} onValueChange={setTargetStoreId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecciona tienda destino" />
                                </SelectTrigger>
                                <SelectContent>
                                    {storeOptions.map((store) => (
                                        <SelectItem key={store.id} value={store.id}>
                                            {companyNameById.get(store.companyId) || "Compañía"} — {store.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button
                            disabled={!eligibleSelected.length || !targetStoreId}
                            onClick={() => setConfirmOpen(true)}
                        >
                            <ArrowRightLeft className="mr-2 h-4 w-4" />
                            Reasignar {eligibleSelected.length} tarjeta(s)
                        </Button>
                    </CardContent>
                </Card>

                {lastResult && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Última remisión</CardTitle>
                            <CardDescription>
                                {lastResult.count} tarjeta(s) → {lastResult.targetStore.companyName} / {lastResult.targetStore.name}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>UUID</TableHead>
                                        <TableHead>Producto</TableHead>
                                        <TableHead>Desde</TableHead>
                                        <TableHead>Hacia</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {lastResult.moved.map((row) => (
                                        <TableRow key={row.uuid}>
                                            <TableCell className="font-mono text-xs">{row.uuid}</TableCell>
                                            <TableCell>{row.product}</TableCell>
                                            <TableCell>{row.fromCompany} — {row.fromStore}</TableCell>
                                            <TableCell>{row.toCompany} — {row.toStore}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                )}
            </div>

            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirmar remisión</DialogTitle>
                        <DialogDescription>
                            Vas a mover {eligibleSelected.length} tarjeta(s) a{" "}
                            <strong>
                                {targetStore
                                    ? `${companyNameById.get(targetStore.companyId) || ""} — ${targetStore.name}`
                                    : "la tienda seleccionada"}
                            </strong>
                            . Esta acción no se puede deshacer desde la UI.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={submitLoading}>
                            Cancelar
                        </Button>
                        <Button onClick={handleReassign} disabled={submitLoading}>
                            {submitLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Reasignando...
                                </>
                            ) : (
                                "Confirmar remisión"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
