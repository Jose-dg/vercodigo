"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Pencil, Loader2 } from "lucide-react";
import { updateQRStore } from "@/app/actions/qr";
import { useToast } from "@/hooks/use-toast";

interface Store {
    id: string;
    name: string;
}

interface QREditStoreButtonProps {
    id: string;
    uuid: string;
    currentStoreId: string;
    stores: Store[];
}

export function QREditStoreButton({ id, uuid, currentStoreId, stores }: QREditStoreButtonProps) {
    const [open, setOpen] = useState(false);
    const [selectedStoreId, setSelectedStoreId] = useState(currentStoreId);
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const handleSubmit = async () => {
        if (selectedStoreId === currentStoreId) {
            setOpen(false);
            return;
        }

        setLoading(true);
        try {
            const result = await updateQRStore(id, selectedStoreId);
            if (result.success) {
                toast({
                    title: "Tienda Actualizada",
                    description: `El código QR ha sido reasignado exitosamente.`,
                });
                setOpen(false);
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "No se pudo actualizar la tienda.",
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
                    <span className="sr-only">Editar Tienda</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Editar Tienda</DialogTitle>
                    <DialogDescription>
                        Reasigna el código QR <span className="font-mono font-semibold">{uuid}</span> a otra tienda.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="store" className="text-right">
                            Tienda
                        </Label>
                        <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                            <SelectTrigger className="col-span-3">
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
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSubmit} disabled={loading || selectedStoreId === currentStoreId}>
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Guardando...
                            </>
                        ) : (
                            "Guardar Cambios"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
