"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Search, UserCheck, Package } from "lucide-react";
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

type OpsClient = {
    id_client: number;
    name: string;
    last_name: string;
    phone: string;
    document_type: string | null;
    document_number: string | null;
    email: string;
    ops_status: "unclassified" | "needs_account" | "operable";
    order_count: number;
};

type OpsStoreProduct = {
    store_product_id: string;
    product_id: string;
    name: string;
    sku: string;
    brand: string | null;
    status: string;
    fulfillment_enabled: boolean;
    active_inventory_source_count: number;
    can_enable_fulfillment: boolean;
    denomination: number | null;
    denomination_currency: string | null;
    mappedInSas?: boolean;
};

function statusBadge(status: OpsClient["ops_status"]) {
    switch (status) {
        case "operable":
            return <Badge className="bg-emerald-600">operable</Badge>;
        case "needs_account":
            return <Badge variant="secondary">sin cuenta en store</Badge>;
        default:
            return <Badge variant="destructive">sin LegalParty</Badge>;
    }
}

export default function OpsDiemPage() {
    const currentUser = useCurrentUser();
    const canUse = currentUser ? isPlatformRole(currentUser.role) : false;

    const [clientQuery, setClientQuery] = useState("");
    const [clientStatus, setClientStatus] = useState("unclassified");
    const [clients, setClients] = useState<OpsClient[]>([]);
    const [clientsLoading, setClientsLoading] = useState(false);

    const [classifyTarget, setClassifyTarget] = useState<OpsClient | null>(null);
    const [legalName, setLegalName] = useState("");
    const [partyType, setPartyType] = useState<"natural_person" | "legal_entity">(
        "natural_person",
    );
    const [tradeName, setTradeName] = useState("");
    const [identityConfirmed, setIdentityConfirmed] = useState(false);
    const [classifyLoading, setClassifyLoading] = useState(false);

    const [productQuery, setProductQuery] = useState("");
    const [productFilter, setProductFilter] = useState("fulfillment_off");
    const [products, setProducts] = useState<OpsStoreProduct[]>([]);
    const [productsLoading, setProductsLoading] = useState(false);
    const [sasMappedIds, setSasMappedIds] = useState<Set<string>>(new Set());
    const [actionId, setActionId] = useState<string | null>(null);

    const loadClients = useCallback(async () => {
        setClientsLoading(true);
        try {
            const params = new URLSearchParams({ status: clientStatus });
            if (clientQuery.trim()) params.set("q", clientQuery.trim());
            const res = await fetch(`/api/ops/diem/clients?${params.toString()}`);
            const body = await res.json();
            if (!res.ok) throw new Error(body.message || body.error || "Error clientes");
            setClients(body.results ?? []);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "No se pudo cargar clientes");
        } finally {
            setClientsLoading(false);
        }
    }, [clientQuery, clientStatus]);

    const loadProducts = useCallback(async () => {
        setProductsLoading(true);
        try {
            const params = new URLSearchParams();
            if (productQuery.trim()) params.set("q", productQuery.trim());
            if (productFilter === "fulfillment_off") params.set("fulfillment_enabled", "false");
            if (productFilter === "fulfillment_on") params.set("fulfillment_enabled", "true");
            if (productFilter === "missing_source") params.set("missing_source", "true");
            const [prodRes, sasRes] = await Promise.all([
                fetch(`/api/ops/diem/store-products?${params.toString()}`),
                fetch("/api/products"),
            ]);
            const prodBody = await prodRes.json();
            if (!prodRes.ok) {
                throw new Error(prodBody.message || prodBody.error || "Error productos");
            }
            const mapped = new Set<string>();
            if (sasRes.ok) {
                const sasProducts = await sasRes.json();
                if (Array.isArray(sasProducts)) {
                    for (const row of sasProducts) {
                        if (row.devDiemProductId) mapped.add(String(row.devDiemProductId));
                        for (const denom of row.denominations ?? []) {
                            if (denom.devDiemProductId) {
                                mapped.add(String(denom.devDiemProductId));
                            }
                        }
                    }
                }
            }
            setSasMappedIds(mapped);
            setProducts(prodBody.results ?? []);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "No se pudo cargar productos");
        } finally {
            setProductsLoading(false);
        }
    }, [productFilter, productQuery]);

    useEffect(() => {
        if (!canUse) return;
        void loadClients();
    }, [canUse, loadClients]);

    useEffect(() => {
        if (!canUse) return;
        void loadProducts();
    }, [canUse, loadProducts]);

    async function submitClassify() {
        if (!classifyTarget || !identityConfirmed) return;
        setClassifyLoading(true);
        try {
            const res = await fetch(
                `/api/ops/diem/clients/${classifyTarget.id_client}/prepare`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        legalName,
                        partyType,
                        tradeName,
                        identityConfirmed: true,
                    }),
                },
            );
            const body = await res.json();
            if (!res.ok) {
                throw new Error(
                    typeof body.detail === "string"
                        ? body.detail
                        : body.message || body.error || "No se pudo clasificar",
                );
            }
            toast.success(`Cliente ${classifyTarget.id_client} operable`);
            setClassifyTarget(null);
            setIdentityConfirmed(false);
            await loadClients();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Error al clasificar");
        } finally {
            setClassifyLoading(false);
        }
    }

    async function enableFulfillment(row: OpsStoreProduct) {
        setActionId(row.store_product_id);
        try {
            const res = await fetch(
                `/api/ops/diem/store-products/${row.store_product_id}/fulfillment`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ enabled: true }),
                },
            );
            const body = await res.json();
            if (!res.ok) {
                throw new Error(body.message || body.error || "No se pudo activar");
            }
            toast.success(`Fulfillment activo: ${row.name}`);
            await loadProducts();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Error fulfillment");
        } finally {
            setActionId(null);
        }
    }

    async function mirrorProduct(row: OpsStoreProduct) {
        setActionId(`mirror-${row.store_product_id}`);
        try {
            const amount = Number(row.denomination ?? 0);
            const currency =
                (row.denomination_currency || "").toUpperCase() === "COP" ? "COP" : "USD";
            const face =
                amount > 0
                    ? amount
                    : currency === "COP"
                      ? 1
                      : 1;
            const res = await fetch("/api/ops/diem/products/mirror", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: row.name,
                    sku: row.sku || row.product_id.slice(0, 12),
                    brand: row.brand || "Digital",
                    category: "Gift Card Digital",
                    amount: face,
                    currency,
                    devDiemProductId: row.product_id,
                }),
            });
            const body = await res.json();
            if (!res.ok) {
                throw new Error(body.message || body.error || "No se pudo crear mirror");
            }
            toast.success(`Mirror SAS: ${body.name}`);
            await loadProducts();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Error mirror");
        } finally {
            setActionId(null);
        }
    }

    if (!canUse) {
        return (
            <div className="flex flex-1 flex-col gap-4 p-6">
                <h1 className="text-2xl font-semibold">Ops Diem</h1>
                <p className="text-gray-500">Solo roles de plataforma pueden usar esta herramienta.</p>
            </div>
        );
    }

    return (
        <>
            <header className="flex h-16 shrink-0 items-center gap-2">
                <div className="flex items-center gap-2 px-4">
                    <SidebarTrigger className="-ml-1" />
                    <Separator orientation="vertical" className="mr-2 h-4" />
                    <Breadcrumb>
                        <BreadcrumbList>
                            <BreadcrumbItem className="hidden md:block">
                                <BreadcrumbLink href="#">Operations</BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator className="hidden md:block" />
                            <BreadcrumbItem>
                                <BreadcrumbPage>Ops Diem</BreadcrumbPage>
                            </BreadcrumbItem>
                        </BreadcrumbList>
                    </Breadcrumb>
                </div>
            </header>

            <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Ops Diem</h1>
                    <p className="text-gray-500">
                        Clasifica clientes sin LegalParty y activa fulfillment del surtido Diem.
                    </p>
                </div>

                <Tabs defaultValue="clients">
                    <TabsList>
                        <TabsTrigger value="clients" className="gap-1.5">
                            <UserCheck className="h-4 w-4" />
                            Clientes
                        </TabsTrigger>
                        <TabsTrigger value="products" className="gap-1.5">
                            <Package className="h-4 w-4" />
                            Productos
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="clients" className="space-y-4">
                        <Card className="border-gray-200 bg-white shadow-sm">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg">Identidad comercial</CardTitle>
                                <CardDescription>
                                    Busca por teléfono, documento o nombre. Clasificar crea LegalParty + CommercialAccount.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex flex-col gap-2 md:flex-row">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                                        <Input
                                            className="pl-8"
                                            placeholder="Teléfono, cédula o nombre…"
                                            value={clientQuery}
                                            onChange={(e) => setClientQuery(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") void loadClients();
                                            }}
                                        />
                                    </div>
                                    <Select value={clientStatus} onValueChange={setClientStatus}>
                                        <SelectTrigger className="w-full md:w-48">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="unclassified">Sin LegalParty</SelectItem>
                                            <SelectItem value="needs_account">Sin cuenta</SelectItem>
                                            <SelectItem value="operable">Operable</SelectItem>
                                            <SelectItem value="all">Todos</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Button
                                        className="bg-blue-600 hover:bg-blue-700"
                                        onClick={() => void loadClients()}
                                        disabled={clientsLoading}
                                    >
                                        {clientsLoading ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            "Buscar"
                                        )}
                                    </Button>
                                </div>

                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>ID</TableHead>
                                            <TableHead>Cliente</TableHead>
                                            <TableHead>Contacto</TableHead>
                                            <TableHead>Estado</TableHead>
                                            <TableHead>Órdenes</TableHead>
                                            <TableHead />
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {clients.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center text-gray-500">
                                                    Sin resultados
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            clients.map((row) => (
                                                <TableRow key={row.id_client}>
                                                    <TableCell>{row.id_client}</TableCell>
                                                    <TableCell>
                                                        <div className="font-medium">
                                                            {row.name} {row.last_name}
                                                        </div>
                                                        <div className="text-xs text-gray-500">
                                                            {[row.document_type, row.document_number]
                                                                .filter(Boolean)
                                                                .join(" ")}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div>{row.phone || "—"}</div>
                                                        <div className="text-xs text-gray-500">{row.email}</div>
                                                    </TableCell>
                                                    <TableCell>{statusBadge(row.ops_status)}</TableCell>
                                                    <TableCell>{row.order_count}</TableCell>
                                                    <TableCell className="text-right">
                                                        {row.ops_status !== "operable" && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => {
                                                                    setClassifyTarget(row);
                                                                    setLegalName(
                                                                        `${row.name} ${row.last_name}`.trim(),
                                                                    );
                                                                    setPartyType("natural_person");
                                                                    setTradeName("");
                                                                    setIdentityConfirmed(false);
                                                                }}
                                                            >
                                                                Clasificar
                                                            </Button>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="products" className="space-y-4">
                        <Card className="border-gray-200 bg-white shadow-sm">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg">Surtido fulfillment</CardTitle>
                                <CardDescription>
                                    Activa StoreProduct.fulfillment_enabled (requiere fuente de inventario). Mirror crea el producto en Buy Codes.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex flex-col gap-2 md:flex-row">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                                        <Input
                                            className="pl-8"
                                            placeholder="Nombre, SKU o brand…"
                                            value={productQuery}
                                            onChange={(e) => setProductQuery(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") void loadProducts();
                                            }}
                                        />
                                    </div>
                                    <Select value={productFilter} onValueChange={setProductFilter}>
                                        <SelectTrigger className="w-full md:w-52">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="fulfillment_off">Fulfillment off</SelectItem>
                                            <SelectItem value="fulfillment_on">Fulfillment on</SelectItem>
                                            <SelectItem value="missing_source">Sin fuente inventario</SelectItem>
                                            <SelectItem value="all">Todos</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Button
                                        className="bg-blue-600 hover:bg-blue-700"
                                        onClick={() => void loadProducts()}
                                        disabled={productsLoading}
                                    >
                                        {productsLoading ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            "Buscar"
                                        )}
                                    </Button>
                                </div>

                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Producto</TableHead>
                                            <TableHead>SKU</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Fulfillment</TableHead>
                                            <TableHead>Fuentes</TableHead>
                                            <TableHead>Mirror SAS</TableHead>
                                            <TableHead />
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {products.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={7} className="text-center text-gray-500">
                                                    Sin resultados
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            products.map((row) => {
                                                const mapped = sasMappedIds.has(row.product_id);
                                                return (
                                                    <TableRow key={row.store_product_id}>
                                                        <TableCell>
                                                            <div className="font-medium">{row.name}</div>
                                                            <div className="text-xs text-gray-500">
                                                                {row.brand}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="font-mono text-xs">
                                                            {row.sku}
                                                        </TableCell>
                                                        <TableCell>{row.status}</TableCell>
                                                        <TableCell>
                                                            {row.fulfillment_enabled ? (
                                                                <Badge className="bg-emerald-600">on</Badge>
                                                            ) : (
                                                                <Badge variant="secondary">off</Badge>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {row.active_inventory_source_count}
                                                            {!row.can_enable_fulfillment
                                                                && !row.fulfillment_enabled && (
                                                                <div className="text-xs text-amber-600">
                                                                    Configura fuente en Admin
                                                                </div>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {mapped ? (
                                                                <Badge variant="outline">mapped</Badge>
                                                            ) : (
                                                                <Badge variant="secondary">missing</Badge>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="space-x-2 text-right">
                                                            {!row.fulfillment_enabled && (
                                                                <Button
                                                                    size="sm"
                                                                    className="bg-blue-600 hover:bg-blue-700"
                                                                    disabled={
                                                                        !row.can_enable_fulfillment
                                                                        || actionId === row.store_product_id
                                                                    }
                                                                    onClick={() => void enableFulfillment(row)}
                                                                >
                                                                    {actionId === row.store_product_id ? (
                                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                                    ) : (
                                                                        "Activar"
                                                                    )}
                                                                </Button>
                                                            )}
                                                            {row.fulfillment_enabled && !mapped && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    disabled={
                                                                        actionId === `mirror-${row.store_product_id}`
                                                                    }
                                                                    onClick={() => void mirrorProduct(row)}
                                                                >
                                                                    Mirror SAS
                                                                </Button>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>

            <Dialog
                open={Boolean(classifyTarget)}
                onOpenChange={(open) => {
                    if (!open) setClassifyTarget(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Clasificar cliente</DialogTitle>
                        <DialogDescription>
                            Confirma el nombre legal y el tipo. No hay matching automático por teléfono.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <div className="space-y-1.5">
                            <Label>Nombre legal</Label>
                            <Input value={legalName} onChange={(e) => setLegalName(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Tipo</Label>
                            <Select
                                value={partyType}
                                onValueChange={(v) =>
                                    setPartyType(v as "natural_person" | "legal_entity")
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="natural_person">Persona natural</SelectItem>
                                    <SelectItem value="legal_entity">Persona jurídica</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Nombre comercial (opcional)</Label>
                            <Input value={tradeName} onChange={(e) => setTradeName(e.target.value)} />
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                            <Checkbox
                                checked={identityConfirmed}
                                onCheckedChange={(v) => setIdentityConfirmed(v === true)}
                            />
                            Confirmo la identidad comercial (identity_confirmed)
                        </label>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setClassifyTarget(null)}>
                            Cancelar
                        </Button>
                        <Button
                            className="bg-blue-600 hover:bg-blue-700"
                            disabled={!identityConfirmed || !legalName.trim() || classifyLoading}
                            onClick={() => void submitClassify()}
                        >
                            {classifyLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                "Clasificar"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
