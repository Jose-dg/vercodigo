"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Calculator, CheckCircle2, MapPin, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PurchaseOriginPhonesPanel } from "@/components/companies/PurchaseOriginPhonesPanel";
import { TrmPricePanel } from "@/components/pricing/TrmPricePanel";

type Company = { companyId: string; companyName: string; currency: string };
type Candidate = { targetType: "CODE_PURCHASE" | "CARD_ACTIVATION"; targetId: string; occurredAt: string; productName: string; denominationAmount: number; quantity: number; total: number | null; rate: number | null; reference: string };
type Preview = Candidate & { oldRate: number; newRate: number; oldTotal: number; newTotal: number; delta: number; walletBalance: number; projectedBalance: number; affectedMovements: number; fingerprint: string };
type PurchaseOrigin = { kind: "phone" | "store"; id: string; label: string | null; phone?: string | null };
type OriginCandidate = { id: string; occurredAt: string; count: number; productName: string; denomination: { amount: number; currency: string } | null; origin: PurchaseOrigin | null };
type OriginCorrectionData = {
    purchases: OriginCandidate[];
    stores: { id: string; name: string }[];
    phones: { id: string; phone: string; label: string }[];
};

const cop = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 2 });
const number = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 4 });

export default function CostsPage() {
    const [isPlatform, setIsPlatform] = useState(false);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [companyId, setCompanyId] = useState("");
    const [query, setQuery] = useState("");
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [selected, setSelected] = useState<Candidate | null>(null);
    const [newRate, setNewRate] = useState("");
    const [reason, setReason] = useState("");
    const [preview, setPreview] = useState<Preview | null>(null);
    const [applying, setApplying] = useState(false);
    const applyKey = useRef<string | null>(null);
    const [originQuery, setOriginQuery] = useState("");
    const [originData, setOriginData] = useState<OriginCorrectionData>({ purchases: [], stores: [], phones: [] });
    const [originPurchase, setOriginPurchase] = useState<OriginCandidate | null>(null);
    const [newOrigin, setNewOrigin] = useState("");
    const [originReason, setOriginReason] = useState("");
    const [applyingOrigin, setApplyingOrigin] = useState(false);
    const originApplyKey = useRef<string | null>(null);

    useEffect(() => {
        fetch("/api/wallets").then((res) => res.json()).then((data) => {
            const next = Array.isArray(data.wallets) ? data.wallets : [];
            setCompanies(next);
            setCompanyId((current) => current || next[0]?.companyId || "");
        }).catch(() => toast.error("No se pudieron cargar las compañías"));
        fetch("/api/auth/me").then((res) => res.json()).then((data) => {
            const platform = data.user?.role === "SUPER_ADMIN" || data.user?.role === "SYSTEM_ADMIN";
            setIsPlatform(platform);
            if (!platform && data.user?.companyId) setCompanyId(data.user.companyId);
        }).catch(() => setIsPlatform(false));
    }, []);

    const loadCandidates = useCallback(async () => {
        if (!companyId) return;
        const qs = new URLSearchParams({ companyId });
        if (query.trim()) qs.set("query", query.trim());
        const res = await fetch(`/api/sales/reprice/candidates?${qs}`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || data.error || "No se pudieron cargar las ventas");
        setCandidates(data.candidates ?? []);
    }, [companyId, query]);
    useEffect(() => {
        if (isPlatform) void loadCandidates().catch(() => undefined);
    }, [isPlatform, loadCandidates]);

    const loadOriginData = useCallback(async () => {
        if (!companyId || !isPlatform) return;
        const qs = new URLSearchParams({ companyId });
        if (originQuery.trim()) qs.set("query", originQuery.trim());
        const res = await fetch(`/api/purchases/origin-correction?${qs}`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || data.error || "No se pudieron cargar las compras");
        setOriginData({ purchases: data.purchases ?? [], stores: data.stores ?? [], phones: data.phones ?? [] });
    }, [companyId, isPlatform, originQuery]);
    useEffect(() => {
        if (isPlatform) void loadOriginData().catch(() => undefined);
    }, [isPlatform, loadOriginData]);

    async function createPreview() {
        if (!selected || !(Number(newRate) > 0)) return toast.error("Selecciona una venta e ingresa la tasa nueva");
        const res = await fetch("/api/sales/reprice/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetType: selected.targetType, targetId: selected.targetId, newRate: Number(newRate) }) });
        const data = await res.json();
        if (!res.ok) return toast.error(data.message || data.error || "No se pudo calcular la corrección");
        setPreview({ ...selected, ...data.preview });
        applyKey.current = crypto.randomUUID();
    }

    async function applyCorrection() {
        if (!preview || reason.trim().length < 3 || !applyKey.current) return toast.error("Escribe el motivo de la corrección");
        setApplying(true);
        try {
            const res = await fetch("/api/sales/reprice/apply", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": applyKey.current }, body: JSON.stringify({ targetType: preview.targetType, targetId: preview.targetId, newRate: preview.newRate, reason, fingerprint: preview.fingerprint }) });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || data.error || "No se pudo aplicar la corrección");
            toast.success("Venta y saldo corregidos en Diem y Diem-SAS");
            setSelected(null); setPreview(null); setNewRate(""); setReason(""); applyKey.current = null;
            await loadCandidates();
        } catch (error) { toast.error(error instanceof Error ? error.message : "Error inesperado"); }
        finally { setApplying(false); }
    }

    function describeOrigin(origin: PurchaseOrigin | null) {
        if (!origin) return "Sin origen específico";
        if (origin.kind === "phone") return `Número: ${origin.phone ?? "—"}${origin.label && origin.label !== origin.phone ? ` · ${origin.label}` : ""}`;
        return `Sede: ${origin.label ?? "—"}`;
    }

    async function applyOriginCorrection() {
        if (!originPurchase || !newOrigin || originReason.trim().length < 3) {
            return toast.error("Selecciona la compra, el nuevo origen y escribe el motivo");
        }
        if (!originApplyKey.current) originApplyKey.current = crypto.randomUUID();
        const separator = newOrigin.indexOf(":");
        const kind = newOrigin.slice(0, separator);
        const id = newOrigin.slice(separator + 1);
        setApplyingOrigin(true);
        try {
            const res = await fetch("/api/purchases/origin-correction", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Idempotency-Key": originApplyKey.current },
                body: JSON.stringify({ purchaseId: originPurchase.id, origin: { kind, id }, reason: originReason }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || data.error || "No se pudo corregir el origen");
            toast.success(data.correction?.changed === false ? "La compra ya tenía ese origen" : "Origen actualizado en Diem y Diem-SAS");
            setOriginPurchase(null);
            setNewOrigin("");
            setOriginReason("");
            originApplyKey.current = null;
            await loadOriginData();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Error inesperado");
        } finally {
            setApplyingOrigin(false);
        }
    }

    return <div className="space-y-6 p-4 sm:p-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h1 className="text-3xl font-bold tracking-tight">Tarifas a compañías</h1><p className="mt-1 text-muted-foreground">{isPlatform ? "Tasa del día por TRM, corrección de valor y de origen de ventas anteriores." : "Consulta la tasa del día que se aplica a tus compras."}</p></div>{isPlatform && <Select value={companyId} onValueChange={(value) => { setCompanyId(value); setSelected(null); setPreview(null); setOriginPurchase(null); setNewOrigin(""); setOriginData({ purchases: [], stores: [], phones: [] }); }}><SelectTrigger className="w-full sm:w-80"><SelectValue placeholder="Seleccionar compañía" /></SelectTrigger><SelectContent>{companies.map((company) => <SelectItem key={company.companyId} value={company.companyId}>{company.companyName}</SelectItem>)}</SelectContent></Select>}</div>
        <Tabs defaultValue="current"><TabsList className="h-auto flex-wrap"><TabsTrigger value="current">Precio actual</TabsTrigger>{isPlatform && <TabsTrigger value="history">Corregir venta anterior</TabsTrigger>}{isPlatform && <TabsTrigger value="origin">Corregir origen</TabsTrigger>}</TabsList>
            <TabsContent value="current" className="mt-4"><TrmPricePanel isPlatform={isPlatform} /></TabsContent>
            {isPlatform && <TabsContent value="history" className="mt-4 space-y-4"><Card><CardHeader><CardTitle>Buscar venta</CardTitle><CardDescription>Historial comercial completo: las 50 compras de códigos y activaciones QR completadas más recientes, incluidas las anteriores al saldo anterior de la wallet. No es el extracto de la wallet. La corrección se realiza de una en una.</CardDescription></CardHeader><CardContent><div className="flex gap-2"><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Orden, fecha AAAA-MM-DD, producto, usuario u origen" onKeyDown={(event) => event.key === "Enter" && void loadCandidates()} /><Button variant="outline" onClick={() => void loadCandidates()}><Search className="mr-2 size-4" />Buscar</Button></div><div className="mt-4 max-h-80 overflow-auto rounded-lg border"><Table><TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Tipo</TableHead><TableHead>Producto</TableHead><TableHead>Referencia</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader><TableBody>{candidates.map((item) => <TableRow key={`${item.targetType}:${item.targetId}`} className="cursor-pointer" data-state={selected?.targetId === item.targetId ? "selected" : undefined} onClick={() => { setSelected(item); setPreview(null); setNewRate(item.rate ? String(item.rate) : ""); }}><TableCell>{new Date(item.occurredAt).toLocaleString("es-CO")}</TableCell><TableCell>{item.targetType === "CODE_PURCHASE" ? "Código" : "Activación"}</TableCell><TableCell>{item.quantity} × US${item.denominationAmount} {item.productName}</TableCell><TableCell className="font-mono text-xs">{item.reference}</TableCell><TableCell className="text-right">{item.total == null ? "—" : cop.format(item.total)}</TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>
                {selected && <Card><CardHeader><CardTitle className="flex items-center gap-2"><Calculator className="size-5" />Calcular corrección</CardTitle><CardDescription>{selected.quantity} × US${selected.denominationAmount} · {selected.productName}</CardDescription></CardHeader><CardContent className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="new-rate">Nueva tasa COP/USD</Label><Input id="new-rate" className="mt-1 font-mono" type="number" min="0" step="0.01" value={newRate} onChange={(event) => { setNewRate(event.target.value); setPreview(null); }} /></div><div className="flex items-end"><Button className="w-full" variant="secondary" onClick={createPreview}>Vista previa</Button></div></div>{preview && <div className="space-y-4 rounded-xl border bg-muted/30 p-4"><div className="grid gap-3 text-sm sm:grid-cols-3"><div><span className="text-muted-foreground">Total anterior</span><div className="font-mono text-lg">{cop.format(preview.oldTotal)}</div></div><div><span className="text-muted-foreground">Total nuevo</span><div className="font-mono text-lg">{cop.format(preview.newTotal)}</div></div><div><span className="text-muted-foreground">Saldo resultante</span><div className="font-mono text-lg">{cop.format(preview.projectedBalance)}</div></div></div><p className="text-sm text-muted-foreground">Se recalcularán {preview.affectedMovements} movimiento(s). La orden en Diem se actualizará antes que la wallet.</p><div><Label htmlFor="reason">Motivo obligatorio</Label><Input id="reason" className="mt-1" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ej. tasa comercial acordada incorrecta" /></div><Button disabled={applying || reason.trim().length < 3} onClick={applyCorrection}><CheckCircle2 className="mr-2 size-4" />{applying ? "Aplicando…" : "Aplicar corrección"}</Button></div>}</CardContent></Card>}
            </TabsContent>}
            {isPlatform && <TabsContent value="origin" className="mt-4 space-y-4">{companyId && <PurchaseOriginPhonesPanel key={companyId} companyId={companyId} stores={originData.stores.map((store) => ({ ...store, isActive: true }))} onChange={loadOriginData} />}<Card><CardHeader><CardTitle>Buscar compra de códigos</CardTitle><CardDescription>Las 50 compras de códigos más recientes de todo el historial. Selecciona una y corrige únicamente quién la solicitó. El saldo, el precio y los códigos no cambian.</CardDescription></CardHeader><CardContent><div className="flex gap-2"><Input value={originQuery} onChange={(event) => setOriginQuery(event.target.value)} placeholder="Orden, producto, usuario u origen" onKeyDown={(event) => event.key === "Enter" && void loadOriginData()} /><Button variant="outline" onClick={() => void loadOriginData()}><Search className="mr-2 size-4" />Buscar</Button></div><div className="mt-4 max-h-80 overflow-auto rounded-lg border"><Table><TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Producto</TableHead><TableHead>Origen actual</TableHead><TableHead>Referencia</TableHead></TableRow></TableHeader><TableBody>{originData.purchases.map((item) => <TableRow key={item.id} className="cursor-pointer" data-state={originPurchase?.id === item.id ? "selected" : undefined} onClick={() => { setOriginPurchase(item); setNewOrigin(""); setOriginReason(""); originApplyKey.current = crypto.randomUUID(); }}><TableCell>{new Date(item.occurredAt).toLocaleString("es-CO")}</TableCell><TableCell>{item.count} × {item.denomination ? `${item.denomination.currency} ${number.format(item.denomination.amount)}` : "Producto"} · {item.productName}</TableCell><TableCell>{describeOrigin(item.origin)}</TableCell><TableCell className="font-mono text-xs">{item.id}</TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>
                {originPurchase && <Card><CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="size-5" />Cambiar origen de la compra</CardTitle><CardDescription>Origen actual: {describeOrigin(originPurchase.origin)}</CardDescription></CardHeader><CardContent className="space-y-4"><div><Label htmlFor="new-origin">Nuevo número o sede</Label><Select value={newOrigin} onValueChange={setNewOrigin}><SelectTrigger id="new-origin" className="mt-1"><SelectValue placeholder="Seleccionar origen" /></SelectTrigger><SelectContent>{originData.stores.map((store) => <SelectItem key={`store:${store.id}`} value={`store:${store.id}`}>Sede: {store.name}</SelectItem>)}{originData.phones.map((phone) => <SelectItem key={`phone:${phone.id}`} value={`phone:${phone.id}`}>Número: {phone.phone}{phone.label !== phone.phone ? ` · ${phone.label}` : ""}</SelectItem>)}</SelectContent></Select></div><div><Label htmlFor="origin-reason">Motivo obligatorio</Label><Input id="origin-reason" className="mt-1" value={originReason} onChange={(event) => setOriginReason(event.target.value)} placeholder="Ej. solicitud realizada desde el número de Edwin" /></div><p className="text-sm text-muted-foreground">Se actualizará la atribución comercial en Diem y Diem-SAS. No se modificarán importes, saldos, códigos, inventario ni fechas.</p><Button disabled={applyingOrigin || !newOrigin || originReason.trim().length < 3} onClick={applyOriginCorrection}><CheckCircle2 className="mr-2 size-4" />{applyingOrigin ? "Aplicando…" : "Aplicar cambio de origen"}</Button></CardContent></Card>}
            </TabsContent>}
        </Tabs>
    </div>;
}
