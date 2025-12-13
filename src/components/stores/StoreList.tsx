"use client";

import { deleteStore } from "@/services/store.service";
import { Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function StoreList({ stores }: { stores: any[] }) {
    const { toast } = useToast();

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`¿Estás seguro de que deseas eliminar la tienda "${name}"?`)) {
            return;
        }

        try {
            await deleteStore(id);
            toast({
                title: "Tienda eliminada",
                description: `La tienda "${name}" ha sido eliminada exitosamente.`,
            });
            window.location.reload();
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "No se pudo eliminar la tienda.",
            });
        }
    };

    return (
        <Card className="bg-white shadow-sm border-gray-200">
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
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {stores.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center text-gray-500">
                                        No hay tiendas registradas.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                stores.map((store) => (
                                    <TableRow key={store.id}>
                                        <TableCell className="font-medium">{store.name}</TableCell>
                                        <TableCell className="text-gray-600">{store.address}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="font-mono text-xs">
                                                {store.code}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-gray-500">{store.phone || "N/A"}</TableCell>
                                        <TableCell>
                                            <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">
                                                Activa
                                            </Badge>
                                        </TableCell>
                                        {store.createdAt && (
                                            <TableCell className="text-gray-500 text-sm">
                                                {format(new Date(store.createdAt), "PPP", { locale: es })}
                                            </TableCell>
                                        )}
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDelete(store.id, store.name)}
                                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                                <span className="sr-only">Eliminar</span>
                                            </Button>
                                        </TableCell>
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