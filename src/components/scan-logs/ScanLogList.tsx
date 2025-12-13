'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Scan, CheckCircle2, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ScanLog {
    id: string;
    card: {
        id: string;
        uuid: string;
        product: {
            name: string;
        };
        store: {
            name: string;
            company: {
                name: string;
            };
        };
    };
    wasSuccess: boolean;
    reason: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    scannedAt: Date;
}

export function ScanLogList({ scanLogs }: { scanLogs: ScanLog[] }) {
    return (
        <Card className="bg-white shadow-sm border-gray-200">
            <CardHeader>
                <CardTitle>Listado de Logs</CardTitle>
                <CardDescription>Total de escaneos: {scanLogs.length}</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Tarjeta</TableHead>
                                <TableHead>Producto</TableHead>
                                <TableHead>Tienda</TableHead>
                                <TableHead>Resultado</TableHead>
                                <TableHead>Razón</TableHead>
                                <TableHead>IP</TableHead>
                                <TableHead>Fecha</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {scanLogs.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center text-gray-500">
                                        No hay logs de escaneo registrados.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                scanLogs.map((log) => (
                                    <TableRow key={log.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                                                    <Scan className="w-5 h-5 text-gray-500" />
                                                </div>
                                                <Badge variant="outline" className="font-mono text-xs">
                                                    {log.card.uuid}
                                                </Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            {log.card.product.name}
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-sm">
                                                <div className="text-gray-900">{log.card.store.name}</div>
                                                <div className="text-gray-500">{log.card.store.company.name}</div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {log.wasSuccess ? (
                                                <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">
                                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                                    Exitoso
                                                </Badge>
                                            ) : (
                                                <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border-red-200">
                                                    <XCircle className="w-3 h-3 mr-1" />
                                                    Fallido
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-gray-600 text-sm">
                                            {log.reason || '-'}
                                        </TableCell>
                                        <TableCell className="text-gray-500 text-xs font-mono">
                                            {log.ipAddress || '-'}
                                        </TableCell>
                                        <TableCell className="text-gray-500 text-sm">
                                            {format(new Date(log.scannedAt), 'PPP p', { locale: es })}
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

