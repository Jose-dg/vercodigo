'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Key, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface KeyItem {
    id: string;
    code: string;
    product: {
        id: string;
        name: string;
    };
    isVerified: boolean;
    transactionId: string | null;
    expiresAt: Date | null;
    createdAt: Date;
    card: {
        id: string;
        uuid: string;
        store: {
            name: string;
            company: {
                name: string;
            };
        };
    } | null;
}

export function KeyList({ keys }: { keys: KeyItem[] }) {
    return (
        <Card className="bg-white shadow-sm border-gray-200">
            <CardHeader>
                <CardTitle>Listado de Claves</CardTitle>
                <CardDescription>Total de claves: {keys.length}</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Código</TableHead>
                                <TableHead>Producto</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead>Asociada a Tarjeta</TableHead>
                                <TableHead>Tienda</TableHead>
                                <TableHead>Creado</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {keys.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center text-gray-500">
                                        No hay claves registradas.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                keys.map((keyItem) => (
                                    <TableRow key={keyItem.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                                                    <Key className="w-5 h-5 text-gray-500" />
                                                </div>
                                                <Badge variant="outline" className="font-mono text-xs">
                                                    {keyItem.code}
                                                </Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            {keyItem.product.name}
                                        </TableCell>
                                        <TableCell>
                                            {keyItem.isVerified ? (
                                                <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">
                                                    Verificada
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-gray-500 border-gray-200">
                                                    No verificada
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {keyItem.card ? (
                                                <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200">
                                                    Sí
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-gray-500 border-gray-200">
                                                    No
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-gray-600">
                                            {keyItem.card ? (
                                                <div className="text-sm">
                                                    <div>{keyItem.card.store.name}</div>
                                                    <div className="text-xs text-gray-500">
                                                        {keyItem.card.store.company.name}
                                                    </div>
                                                </div>
                                            ) : (
                                                '-'
                                            )}
                                        </TableCell>
                                        <TableCell className="text-gray-500 text-sm">
                                            {format(new Date(keyItem.createdAt), 'PPP', { locale: es })}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" asChild>
                                                <Link href={`/keys/${keyItem.id}`}>
                                                    <Eye className="h-4 w-4 text-gray-500" />
                                                    <span className="sr-only">Ver detalles</span>
                                                </Link>
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

