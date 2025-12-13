"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";

interface Denomination {
    amount: number;
    currency: string;
}

export function ProductForm() {
    const [name, setName] = useState("");
    const [sku, setSku] = useState("");
    const [brand, setBrand] = useState("");
    const [category, setCategory] = useState("");
    const [denominations, setDenominations] = useState<Denomination[]>([{ amount: 0, currency: "USD" }]);
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const { toast } = useToast();

    const handleAddDenomination = () => {
        setDenominations([...denominations, { amount: 0, currency: "USD" }]);
    };

    const handleRemoveDenomination = (index: number) => {
        setDenominations(denominations.filter((_, i) => i !== index));
    };

    const handleDenominationChange = (index: number, field: keyof Denomination, value: string | number) => {
        const newDenominations = [...denominations];
        newDenominations[index] = { ...newDenominations[index], [field]: value };
        setDenominations(newDenominations);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch("/api/products", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                    sku,
                    brand,
                    category,
                    denominations: denominations.filter((d) => d.amount > 0),
                }),
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || "Error al crear producto");
            }

            toast({
                title: "Producto creado",
                description: "El producto se ha creado exitosamente.",
            });

            router.push("/store");
            router.refresh();
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Error",
                description: error.message,
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-8 max-w-5xl mx-auto">
            <div className="grid gap-8 md:grid-cols-[2fr,1fr]">
                <div className="space-y-8">
                    <Card className="bg-white shadow-sm border-gray-200">
                        <CardHeader>
                            <CardTitle className="text-xl font-semibold text-gray-900">Detalles del Producto</CardTitle>
                            <CardDescription>Información básica del producto.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name" className="text-gray-700 font-medium">Nombre del Producto</Label>
                                <Input
                                    id="name"
                                    placeholder="Ej: Netflix Gift Card"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                    className="bg-gray-50 border-gray-300 focus:ring-blue-500 focus:bg-white transition-colors"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="brand" className="text-gray-700 font-medium">Marca</Label>
                                    <Input
                                        id="brand"
                                        placeholder="Ej: Netflix"
                                        value={brand}
                                        onChange={(e) => setBrand(e.target.value)}
                                        required
                                        className="bg-gray-50 border-gray-300 focus:ring-blue-500 focus:bg-white transition-colors"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="category" className="text-gray-700 font-medium">Categoría</Label>
                                    <Input
                                        id="category"
                                        placeholder="Ej: Entretenimiento"
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value)}
                                        className="bg-gray-50 border-gray-300 focus:ring-blue-500 focus:bg-white transition-colors"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-white shadow-sm border-gray-200">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                            <div className="space-y-1">
                                <CardTitle className="text-xl font-semibold text-gray-900">Denominaciones</CardTitle>
                                <CardDescription>Configura los montos disponibles.</CardDescription>
                            </div>
                            <Button type="button" variant="outline" size="sm" onClick={handleAddDenomination} className="border-blue-200 text-blue-700 hover:bg-blue-50">
                                <Plus className="h-4 w-4 mr-2" />
                                Agregar
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {denominations.map((denom, index) => (
                                <div key={index} className="flex items-center gap-4 p-4 rounded-lg border border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-colors">
                                    <div className="flex-1 space-y-1">
                                        <Label className="text-xs text-gray-500">Monto</Label>
                                        <Input
                                            type="number"
                                            placeholder="0.00"
                                            value={denom.amount}
                                            onChange={(e) => handleDenominationChange(index, "amount", parseFloat(e.target.value))}
                                            required
                                            className="bg-white border-gray-200 text-gray-900"
                                        />
                                    </div>
                                    <div className="w-32 space-y-1">
                                        <Label className="text-xs text-gray-500">Moneda</Label>
                                        <Input
                                            placeholder="USD"
                                            value={denom.currency}
                                            onChange={(e) => handleDenominationChange(index, "currency", e.target.value)}
                                            required
                                            className="bg-white border-gray-200 text-gray-900"
                                        />
                                    </div>
                                    <div className="pt-5">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleRemoveDenomination(index)}
                                            disabled={denominations.length === 1}
                                            className="text-gray-400 hover:text-red-600 hover:bg-red-50"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-8">
                    <Card className="bg-white shadow-sm border-gray-200">
                        <CardHeader>
                            <CardTitle className="text-xl font-semibold text-gray-900">Inventario</CardTitle>
                            <CardDescription>Identificadores únicos.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="sku" className="text-gray-700 font-medium">SKU (Stock Keeping Unit)</Label>
                                <Input
                                    id="sku"
                                    placeholder="Ej: NFLX-USD"
                                    value={sku}
                                    onChange={(e) => setSku(e.target.value)}
                                    required
                                    className="bg-gray-50 border-gray-300 focus:ring-blue-500 focus:bg-white transition-colors font-mono"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex flex-col gap-4">
                        <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-sm py-6 text-lg" disabled={loading}>
                            {loading ? "Creando..." : "Crear Producto"}
                        </Button>
                        <Button type="button" variant="outline" className="w-full border-gray-300" onClick={() => router.back()}>
                            Cancelar
                        </Button>
                    </div>
                </div>
            </div>
        </form>
    );
}
