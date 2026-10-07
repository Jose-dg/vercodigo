'use client';

import { Package } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface ProductData {
    id: string;
    name: string;
    sku: string;
    brand: string;
    category?: string | null;
    isActive: boolean;
    denominations: { amount: number; currency: string }[];
    createdAt?: Date | string;
}

export function ProductList({ products }: { products: ProductData[] }) {
    return (
        <Card className="bg-card shadow-sm border-border">
            <CardHeader>
                <CardTitle>Listado de Productos</CardTitle>
                <CardDescription>
                    Total de productos: {products.length}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Producto</TableHead>
                                <TableHead>Marca</TableHead>
                                <TableHead>Categoría</TableHead>
                                <TableHead>SKU</TableHead>
                                <TableHead>Denominaciones</TableHead>
                                <TableHead>Estado</TableHead>
                                {products.length > 0 && products[0].createdAt && (
                                    <TableHead>Creado</TableHead>
                                )}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {products.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                        No hay productos registrados.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                products.map((product) => (
                                    <TableRow key={product.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                                                    <Package className="w-5 h-5 text-muted-foreground" />
                                                </div>
                                                <span className="font-medium text-foreground">{product.name}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">{product.brand}</TableCell>
                                        <TableCell>
                                            {product.category ? (
                                                <Badge variant="outline" className="text-muted-foreground border-border">
                                                    {product.category}
                                                </Badge>
                                            ) : (
                                                <span className="text-muted-foreground">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="font-mono text-xs">
                                                {product.sku}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1">
                                                {product.denominations.length > 0 ? (
                                                    product.denominations.map((d, idx) => (
                                                        <Badge
                                                            key={idx}
                                                            className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200"
                                                        >
                                                            {formatCurrency(d.amount, d.currency)}
                                                        </Badge>
                                                    ))
                                                ) : (
                                                    <span className="text-muted-foreground text-sm">Sin denominaciones</span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {product.isActive ? (
                                                <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">
                                                    Activo
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-muted-foreground border-border">
                                                    Inactivo
                                                </Badge>
                                            )}
                                        </TableCell>
                                        {product.createdAt && (
                                            <TableCell className="text-muted-foreground text-sm">
                                                {format(new Date(product.createdAt), "PPP", { locale: es })}
                                            </TableCell>
                                        )}
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
