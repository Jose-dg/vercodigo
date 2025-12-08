import prisma from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus, QrCode } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { QRStatusToggle } from "@/components/qr/QRStatusToggle";
import { QRDeleteButton } from "@/components/qr/QRDeleteButton";

export const dynamic = "force-dynamic";

import { Prisma } from "@prisma/client";


export default async function QRPage() {
    const qrs: Prisma.CardGetPayload<{
        include: {
            product: true;
            store: true;
            denomination: true;
        };
    }>[] = await prisma.card.findMany({
        include: {
            product: true,
            store: true,
            denomination: true,
        },
        orderBy: {
            createdAt: "desc",
        },
    });

    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">Códigos QR</h1>
                    <p className="text-gray-500 mt-2">Gestiona y monitorea los códigos QR generados.</p>
                </div>
                <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
                    <Link href="/qr/create">
                        <Plus className="mr-2 h-4 w-4" />
                        Generar Nuevos QR
                    </Link>
                </Button>
            </div>

            <Card className="bg-white shadow-sm border-gray-200">
                <CardHeader>
                    <CardTitle>Listado de Códigos</CardTitle>
                    <CardDescription>
                        Total de códigos generados: {qrs.length}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>UUID</TableHead>
                                    <TableHead>Producto</TableHead>
                                    <TableHead>Tienda</TableHead>
                                    <TableHead>Monto</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead>Creado</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {qrs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center text-gray-500">
                                            No hay códigos QR generados.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    qrs.map((qr) => (
                                        <TableRow key={qr.id}>
                                            <TableCell className="font-mono text-xs">{qr.uuid}</TableCell>
                                            <TableCell className="font-medium">{qr.product.name}</TableCell>
                                            <TableCell>{qr.store.name}</TableCell>
                                            <TableCell>
                                                ${(qr.customAmount ?? qr.denomination?.amount ?? 0).toFixed(2)}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex gap-2">
                                                    {qr.isActivated ? (
                                                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">
                                                            Activado
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-gray-500 border-gray-200">
                                                            Inactivo
                                                        </Badge>
                                                    )}
                                                    {qr.isRedeemed && (
                                                        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200">
                                                            Canjeado
                                                        </Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-gray-500 text-sm">
                                                {format(new Date(qr.createdAt), "PPP p", { locale: es })}
                                            </TableCell>

                                            <TableCell className="text-right">
                                                <div className="flex justify-end items-center gap-2">
                                                    <QRStatusToggle
                                                        id={qr.id}
                                                        isActivated={qr.isActivated}
                                                        isRedeemed={qr.isRedeemed}
                                                    />
                                                    <Button variant="ghost" size="icon" asChild>
                                                        <Link href={`/qr/${qr.uuid}`}>
                                                            <QrCode className="h-4 w-4 text-gray-500" />
                                                            <span className="sr-only">Ver detalles</span>
                                                        </Link>
                                                    </Button>
                                                    <QRDeleteButton id={qr.id} uuid={qr.uuid} />
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}