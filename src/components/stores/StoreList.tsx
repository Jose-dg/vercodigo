"use client";

import { Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface StoreRow {
    id: string; name: string; address: string; code: string; phone: string; isActive: boolean;
    createdAt?: Date | string;
}

export default function StoreList({ stores, canDelete }: { stores: StoreRow[]; canDelete: boolean }) {
    const { toast } = useToast();

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`¿Estás seguro de que deseas eliminar la tienda "${name}"?`)) {
            return;
        }

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(id)}`, { method: "DELETE" });
            if (!response.ok) throw new Error("No se pudo eliminar la sede");
            toast({
                title: "Tienda eliminada",
                description: `La tienda "${name}" ha sido eliminada exitosamente.`,
            });
            window.location.reload();
        } catch {
            toast({
                variant: "destructive",
                title: "Error",
                description: "No se pudo eliminar la tienda.",
            });
        }
    };

    return (
        <Card className="bg-card shadow-sm border-border">
            <CardHeader>
                <CardTitle>Listado de Tiendas</CardTitle>
                <CardDescription>
                    Total de tiendas: {stores.length}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nombre</TableHead>
                                <TableHead>Dirección</TableHead>
                                <TableHead>Código</TableHead>
                                <TableHead>Teléfono</TableHead>
                                <TableHead>Estado</TableHead>
                                {stores.length > 0 && stores[0].createdAt && (
                                    <TableHead>Creado</TableHead>
                                )}
                                {canDelete && <TableHead className="text-right">Acciones</TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {stores.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                        No hay tiendas registradas.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                stores.map((store) => (
                                    <TableRow key={store.id}>
                                        <TableCell className="font-medium">{store.name}</TableCell>
                                        <TableCell className="text-muted-foreground">{store.address}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="font-mono text-xs">
                                                {store.code}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">{store.phone || "N/A"}</TableCell>
                                        <TableCell>
                                            <Badge className={store.isActive ? "bg-green-100 text-green-800 hover:bg-green-100 border-green-200" : "bg-red-100 text-red-800 hover:bg-red-100 border-red-200"}>
                                                {store.isActive ? "Activa" : "Inactiva"}
                                            </Badge>
                                        </TableCell>
                                        {store.createdAt && (
                                            <TableCell className="text-muted-foreground text-sm">
                                                {format(new Date(store.createdAt), "PPP", { locale: es })}
                                            </TableCell>
                                        )}
                                        {canDelete && <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDelete(store.id, store.name)}
                                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                            >
                                                <Trash2 aria-hidden="true" className="h-4 w-4" />
                                                <span className="sr-only">Eliminar</span>
                                            </Button>
                                        </TableCell>}
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
