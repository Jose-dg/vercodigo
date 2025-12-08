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

interface Product {
    id: string;
    name: string;
    sku: string;
    denominations: { id: string; amount: number; currency: string }[];
}

interface Store {
    id: string;
    name: string;
    code: string;
}

export function QRGeneratorForm() {
    const [products, setProducts] = useState<Product[]>([]);
    const [stores, setStores] = useState<Store[]>([]);
    const [selectedProduct, setSelectedProduct] = useState("");
    const [selectedStore, setSelectedStore] = useState("");
    const [amount, setAmount] = useState<number | "">("");
    const [quantity, setQuantity] = useState(1);
    const [loading, setLoading] = useState(false);
    const [generatedQRs, setGeneratedQRs] = useState<any[]>([]);
    const { toast } = useToast();

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [productsRes, storesRes] = await Promise.all([
                    fetch("/api/products"),
                    fetch("/api/stores"),
                ]);

                if (productsRes.ok) {
                    const productsData = await productsRes.json();
                    setProducts(productsData);
                }

                if (storesRes.ok) {
                    const storesData = await storesRes.json();
                    setStores(storesData);
                }
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
        setLoading(true);
        try {
            const newQRs: any[] = [];
            for (let i = 0; i < quantity; i++) {
                const res = await fetch("/api/qr/generate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        storeId: selectedStore,
                        productId: selectedProduct,
                        quantity: 1,
                        customAmount: Number(amount),
                    }),
                });

                if (!res.ok) throw new Error("Failed to generate QR");

                const data = await res.json();
                newQRs.push(data);
            }

            setGeneratedQRs((prev) => [...prev, ...newQRs]);

            toast({
                title: "QRs Generados",
                description: `Se han generado ${quantity} códigos QR exitosamente.`,
            });
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "No se pudo generar los códigos QR.",
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
            <Card className="bg-white shadow-sm border-gray-200">
                <CardHeader>
                    <CardTitle className="text-xl font-semibold text-gray-900">Configuración de Generación</CardTitle>
                    <CardDescription>Selecciona los parámetros para generar los códigos QR.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label className="text-gray-700 font-medium">Producto</Label>
                            <Select onValueChange={setSelectedProduct} value={selectedProduct}>
                                <SelectTrigger className="bg-gray-50 border-gray-300 focus:ring-blue-500">
                                    <SelectValue placeholder="Seleccionar producto" />
                                </SelectTrigger>
                                <SelectContent>
                                    {products.map((product) => (
                                        <SelectItem key={product.id} value={product.id}>
                                            <span className="font-medium">{product.name}</span>
                                            <span className="text-gray-500 text-xs ml-2">({product.sku})</span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-gray-700 font-medium">Tienda</Label>
                            <Select onValueChange={setSelectedStore} value={selectedStore}>
                                <SelectTrigger className="bg-gray-50 border-gray-300 focus:ring-blue-500">
                                    <SelectValue placeholder="Seleccionar tienda" />
                                </SelectTrigger>
                                <SelectContent>
                                    {stores.map((store) => (
                                        <SelectItem key={store.id} value={store.id}>
                                            <span className="font-medium">{store.name}</span>
                                            <span className="text-gray-500 text-xs ml-2">({store.code})</span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label className="text-gray-700 font-medium">Monto</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                                <Input
                                    type="number"
                                    placeholder="0.00"
                                    value={amount}
                                    onChange={(e) => setAmount(Number(e.target.value))}
                                    className="pl-7 bg-gray-50 border-gray-300 focus:bg-white transition-colors"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-gray-700 font-medium">Cantidad a Generar</Label>
                            <Input
                                type="number"
                                min="1"
                                max="100"
                                value={quantity}
                                onChange={(e) => setQuantity(Number(e.target.value))}
                                className="bg-gray-50 border-gray-300 focus:bg-white transition-colors"
                            />
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="bg-gray-50/50 border-t border-gray-100 p-6">
                    <Button
                        onClick={handleGenerate}
                        disabled={loading || !selectedProduct || !selectedStore}
                        className="w-full md:w-auto md:ml-auto bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                    >
                        {loading ? "Generando..." : "Generar Códigos QR"}
                    </Button>
                </CardFooter>
            </Card>

            {generatedQRs.length > 0 && (
                <Card className="bg-white shadow-sm border-gray-200">
                    <CardHeader>
                        <CardTitle className="text-xl font-semibold text-gray-900">Códigos Generados</CardTitle>
                        <CardDescription>Haz clic en un código para ver detalles y descargar.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {generatedQRs.map((qr, i) => (
                                <Dialog key={i}>
                                    <DialogTrigger asChild>
                                        <div className="group relative border border-gray-200 rounded-lg p-4 flex flex-col items-center bg-white hover:shadow-md transition-shadow cursor-pointer">
                                            <div className="bg-white p-2 rounded-md">
                                                <QRCodeCanvas value={qr.qrData} size={128} />
                                            </div>
                                            <span className="text-[10px] mt-3 font-mono text-gray-500 truncate w-full text-center bg-gray-50 py-1 px-2 rounded">
                                                {qr.uuid}
                                            </span>
                                        </div>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-md">
                                        <DialogHeader>
                                            <DialogTitle>Código QR</DialogTitle>
                                        </DialogHeader>
                                        <div className="flex flex-col items-center space-y-4 py-4">
                                            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                                                <QRCodeCanvas
                                                    id={`qr-canvas-${qr.uuid}`}
                                                    value={qr.qrData}
                                                    size={256}
                                                    level={"H"}
                                                    includeMargin={true}
                                                />
                                            </div>
                                            <p className="text-sm font-mono text-gray-500 bg-gray-50 px-3 py-1 rounded-full">
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
