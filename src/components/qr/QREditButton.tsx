"use client";

import * as React from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarProvider,
} from "@/components/ui/sidebar";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
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
import {
    Pencil,
    Settings,
    DollarSign,
    BarChart3,
    Loader2,
    Save
} from "lucide-react";
import { updateQR } from "@/app/actions/qr";
import { useToast } from "@/hooks/use-toast";

interface Store {
    id: string;
    name: string;
}

interface Product {
    id: string;
    name: string;
}

interface QREditButtonProps {
    id: string;
    uuid: string;
    initialData: {
        productId: string;
        storeId: string;
        fabricationUnitCost: number;
        scanCount: number;
        maxScans: number;
    };
    stores: Store[];
    products: Product[];
}

const NAV_ITEMS = [
    { name: "General", icon: Settings, id: "general" },
    { name: "Límites", icon: BarChart3, id: "limits" },
    { name: "Costos", icon: DollarSign, id: "costs" },
];

export function QREditButton({ id, uuid, initialData, stores, products }: QREditButtonProps) {
    const [open, setOpen] = React.useState(false);
    const [activeTab, setActiveTab] = React.useState("general");
    const [loading, setLoading] = React.useState(false);
    const { toast } = useToast();

    const [formData, setFormData] = React.useState(initialData);

    const handleChange = (field: keyof typeof formData, value: string | number) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            const result = await updateQR(id, {
                ...formData,
                fabricationUnitCost: Number(formData.fabricationUnitCost),
                scanCount: Number(formData.scanCount),
                maxScans: Number(formData.maxScans),
            });

            if (result.success) {
                toast({
                    title: "QR Actualizado",
                    description: `El código QR ${uuid} ha sido actualizado exitosamente.`,
                });
                setOpen(false);
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "No se pudo actualizar el QR.",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon">
                    <Pencil className="h-4 w-4 text-gray-500" />
                    <span className="sr-only">Editar QR</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="overflow-hidden p-0 md:max-h-[500px] md:max-w-[700px] lg:max-w-[800px]">
                <DialogTitle className="sr-only">Editar QR</DialogTitle>
                <DialogDescription className="sr-only">
                    Modifica los detalles del código QR.
                </DialogDescription>
                <SidebarProvider className="items-start">
                    <Sidebar collapsible="none" className="hidden md:flex w-60 border-r">
                        <SidebarContent>
                            <SidebarGroup>
                                <SidebarGroupContent>
                                    <SidebarMenu>
                                        {NAV_ITEMS.map((item) => (
                                            <SidebarMenuItem key={item.id}>
                                                <SidebarMenuButton
                                                    isActive={activeTab === item.id}
                                                    onClick={() => setActiveTab(item.id)}
                                                >
                                                    <item.icon className="mr-2 h-4 w-4" />
                                                    <span>{item.name}</span>
                                                </SidebarMenuButton>
                                            </SidebarMenuItem>
                                        ))}
                                    </SidebarMenu>
                                </SidebarGroupContent>
                            </SidebarGroup>
                        </SidebarContent>
                    </Sidebar>
                    <main className="flex h-[480px] flex-1 flex-col overflow-hidden bg-white">
                        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-6">
                            <Breadcrumb>
                                <BreadcrumbList>
                                    <BreadcrumbItem className="hidden md:block">
                                        <BreadcrumbLink href="#">Editar QR</BreadcrumbLink>
                                    </BreadcrumbItem>
                                    <BreadcrumbSeparator className="hidden md:block" />
                                    <BreadcrumbItem>
                                        <BreadcrumbPage>
                                            {NAV_ITEMS.find((i) => i.id === activeTab)?.name}
                                        </BreadcrumbPage>
                                    </BreadcrumbItem>
                                </BreadcrumbList>
                            </Breadcrumb>
                            <div className="ml-auto flex items-center gap-2">
                                <Button size="sm" onClick={handleSubmit} disabled={loading}>
                                    {loading ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Save className="mr-2 h-4 w-4" />
                                    )}
                                    Guardar
                                </Button>
                            </div>
                        </header>
                        <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
                            {activeTab === "general" && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="space-y-2">
                                        <h3 className="text-lg font-medium">Información General</h3>
                                        <p className="text-sm text-gray-500">
                                            Configura los datos básicos del código QR.
                                        </p>
                                    </div>
                                    <Separator />
                                    <div className="grid gap-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="product">Producto</Label>
                                            <Select
                                                value={formData.productId}
                                                onValueChange={(val) => handleChange("productId", val)}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Selecciona un producto" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {products.map((product) => (
                                                        <SelectItem key={product.id} value={product.id}>
                                                            {product.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="store">Tienda</Label>
                                            <Select
                                                value={formData.storeId}
                                                onValueChange={(val) => handleChange("storeId", val)}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Selecciona una tienda" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {stores.map((store) => (
                                                        <SelectItem key={store.id} value={store.id}>
                                                            {store.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === "limits" && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="space-y-2">
                                        <h3 className="text-lg font-medium">Límites de Escaneo</h3>
                                        <p className="text-sm text-gray-500">
                                            Controla cuántas veces se puede escanear este código.
                                        </p>
                                    </div>
                                    <Separator />
                                    <div className="grid gap-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="scanCount">Escaneos Actuales</Label>
                                            <Input
                                                id="scanCount"
                                                type="number"
                                                value={formData.scanCount}
                                                onChange={(e) => handleChange("scanCount", e.target.value)}
                                            />
                                            <p className="text-xs text-gray-500">
                                                Número de veces que ya ha sido escaneado.
                                            </p>
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="maxScans">Máximo de Escaneos</Label>
                                            <Input
                                                id="maxScans"
                                                type="number"
                                                value={formData.maxScans}
                                                onChange={(e) => handleChange("maxScans", e.target.value)}
                                            />
                                            <p className="text-xs text-gray-500">
                                                Límite total de escaneos permitidos antes de bloquearse.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === "costs" && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="space-y-2">
                                        <h3 className="text-lg font-medium">Costos de Fabricación</h3>
                                        <p className="text-sm text-gray-500">
                                            Gestiona los costos asociados a la producción de este QR.
                                        </p>
                                    </div>
                                    <Separator />
                                    <div className="grid gap-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="cost">Costo Unitario</Label>
                                            <div className="relative">
                                                <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                                                <Input
                                                    id="cost"
                                                    type="number"
                                                    step="0.01"
                                                    className="pl-8"
                                                    value={formData.fabricationUnitCost}
                                                    onChange={(e) => handleChange("fabricationUnitCost", e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </main>
                </SidebarProvider>
            </DialogContent>
        </Dialog>
    );
}
