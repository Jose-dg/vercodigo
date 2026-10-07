"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Download } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";

interface QrCatalogItem {
    productId: string;
    denominationId: string;
    name: string;
    sku: string;
    amount: number;
    currency: string;
}

interface Store {
    id: string;
    name: string;
    code: string;
    isActive: boolean;
}

interface GeneratedQr {
    id: string;
    uuid: string;
    qrData: string;
}

export function QRGeneratorForm() {
    const [catalog, setCatalog] = useState<QrCatalogItem[]>([]);
    const [stores, setStores] = useState<Store[]>([]);
    const [selectedDenomination, setSelectedDenomination] = useState("");
    const [selectedStore, setSelectedStore] = useState("");
    const [quantity, setQuantity] = useState(1);
    const [loading, setLoading] = useState(false);
    const [generatedQRs, setGeneratedQRs] = useState<GeneratedQr[]>([]);
    const { toast } = useToast();
    const selectedItem = catalog.find(
        (item) => item.denominationId === selectedDenomination,
    );

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [catalogRes, storesRes] = await Promise.all([
                    fetch("/api/qr/catalog"),
                    fetch("/api/stores"),
                ]);

                if (!catalogRes.ok || !storesRes.ok) {
                    throw new Error("No se pudo cargar el catálogo QR");
                }

                const catalogData = await catalogRes.json();
                const storesData: Store[] = await storesRes.json();
                setCatalog(catalogData.items);
                setStores(storesData.filter((store) => store.isActive));
            } catch (error) {
                console.error("Error fetching data", error);
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: "No se pudo cargar la información de productos y tiendas.",
                });
            }
        };
        fetchData();
    }, [toast]);

    const handleGenerate = async () => {
        if (!selectedItem) return;
        setLoading(true);
        try {
            const res = await fetch("/api/qr/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    storeId: selectedStore,
                    productId: selectedItem.productId,
                    denominationId: selectedItem.denominationId,
                    quantity,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "No se pudieron generar los QR");
            }

            setGeneratedQRs((prev) => [...prev, ...data.cards]);

            toast({
                title: "QRs Generados",
                description: `Se han generado ${quantity} códigos QR exitosamente.`,
            });
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: error instanceof Error
                    ? error.message
                    : "No se pudieron generar los códigos QR.",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = (uuid: string) => {
        const canvas = document.getElementById(`qr-canvas-${uuid}`) as HTMLCanvasElement;
        if (canvas) {
            const pngUrl = canvas.toDataURL("image/png");
            const downloadLink = document.createElement("a");
            downloadLink.href = pngUrl;
            downloadLink.download = `qr-${uuid}.png`;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
        }
    };

    return (
        <div className="space-y-8 max-w-4xl mx-auto">
            <Card className="bg-card shadow-sm border-border">
                <CardHeader>
                    <CardTitle className="text-xl font-semibold text-foreground">Configuración de Generación</CardTitle>
                    <CardDescription>Selecciona los parámetros para generar los códigos QR.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label className="text-foreground font-medium">Producto</Label>
                            <Select onValueChange={setSelectedDenomination} value={selectedDenomination}>
                                <SelectTrigger className="bg-muted/40 border-border focus:ring-blue-500">
                                    <SelectValue placeholder="Seleccionar producto" />
                                </SelectTrigger>
                                <SelectContent>
                                    {catalog.map((item) => (
                                        <SelectItem key={item.denominationId} value={item.denominationId}>
                                            <span className="font-medium">{item.name}</span>
                                            <span className="text-muted-foreground text-xs ml-2">
                                                {item.currency} {new Intl.NumberFormat("es-CO").format(item.amount)}
                                            </span>
                                            <span className="text-muted-foreground text-xs ml-2">({item.sku})</span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-foreground font-medium">Tienda</Label>
                            <Select onValueChange={setSelectedStore} value={selectedStore}>
                                <SelectTrigger className="bg-muted/40 border-border focus:ring-blue-500">
                                    <SelectValue placeholder="Seleccionar tienda" />
                                </SelectTrigger>
                                <SelectContent>
                                    {stores.map((store) => (
                                        <SelectItem key={store.id} value={store.id}>
                                            <span className="font-medium">{store.name}</span>
                                            <span className="text-muted-foreground text-xs ml-2">({store.code})</span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label className="text-foreground font-medium">Monto</Label>
                            <div className="relative">
                                <Input
                                    type="text"
                                    placeholder="Selecciona un producto"
                                    value={selectedItem
                                        ? `${selectedItem.currency} ${new Intl.NumberFormat("es-CO").format(selectedItem.amount)}`
                                        : ""}
                                    readOnly
                                    className="bg-muted border-border"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-foreground font-medium">Cantidad a Generar</Label>
                            <Input
                                type="number"
                                min="1"
                                max="100"
                                value={quantity}
                                onChange={(e) => setQuantity(Number(e.target.value))}
                                className="bg-muted/40 border-border focus:bg-card transition-colors"
                            />
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="bg-muted/40/50 border-t border-gray-100 p-6">
                    <Button
                        onClick={handleGenerate}
                        disabled={
                            loading
                            || !selectedItem
                            || !selectedStore
                            || !Number.isInteger(quantity)
                            || quantity < 1
                            || quantity > 100
                        }
                        className="w-full md:w-auto md:ml-auto bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                    >
                        {loading ? "Generando..." : "Generar Códigos QR"}
                    </Button>
                </CardFooter>
            </Card>

            {generatedQRs.length > 0 && (
                <Card className="bg-card shadow-sm border-border">
                    <CardHeader>
                        <CardTitle className="text-xl font-semibold text-foreground">Códigos Generados</CardTitle>
                        <CardDescription>Haz clic en un código para ver detalles y descargar.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {generatedQRs.map((qr) => (
                                <Dialog key={qr.id}>
                                    <DialogTrigger asChild>
                                        <div className="group relative border border-border rounded-lg p-4 flex flex-col items-center bg-card hover:shadow-md transition-shadow cursor-pointer">
                                            <div className="bg-card p-2 rounded-md">
                                                <QRCodeCanvas value={qr.qrData} size={128} />
                                            </div>
                                            <span className="text-[10px] mt-3 font-mono text-muted-foreground truncate w-full text-center bg-muted/40 py-1 px-2 rounded">
                                                {qr.uuid}
                                            </span>
                                        </div>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-md">
                                        <DialogHeader>
                                            <DialogTitle>Código QR</DialogTitle>
                                        </DialogHeader>
                                        <div className="flex flex-col items-center space-y-4 py-4">
                                            <div className="bg-card p-4 rounded-lg border border-border shadow-sm">
                                                <QRCodeCanvas
                                                    id={`qr-canvas-${qr.uuid}`}
                                                    value={qr.qrData}
                                                    size={256}
                                                    level={"H"}
                                                    includeMargin={true}
                                                />
                                            </div>
                                            <p className="text-sm font-mono text-muted-foreground bg-muted/40 px-3 py-1 rounded-full">
                                                {qr.uuid}
                                            </p>
                                            <Button onClick={() => handleDownload(qr.uuid)} className="w-full sm:w-auto">
                                                <Download className="mr-2 h-4 w-4" />
                                                Descargar PNG
                                            </Button>
                                        </div>
                                    </DialogContent>
                                </Dialog>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
