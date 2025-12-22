"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import Link from "next/link";
import { QrCode } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { QRStatusToggle } from "@/components/qr/QRStatusToggle";
import { QRDeleteButton } from "@/components/qr/QRDeleteButton";
import { QRUpdateKeyButton } from "@/components/qr/QRUpdateKeyButton";
import { QREditButton } from "@/components/qr/QREditButton";
import { QRDownloadSVGButton } from "@/components/qr/QRDownloadSVGButton";
import { QRBulkActions } from "@/components/qr/QRBulkActions";
import { Prisma } from "@prisma/client";

type QRWithRelations = Prisma.CardGetPayload<{
    include: {
        product: true;
        store: true;
        denomination: true;
        key: true;
    };
}>;

interface QRTableProps {
    qrs: QRWithRelations[];
    stores: { id: string; name: string }[];
    products: { id: string; name: string }[];
}

export function QRTable({ qrs, stores, products }: QRTableProps) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const toggleSelectAll = () => {
        if (selectedIds.size === qrs.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(qrs.map((qr) => qr.id)));
        }
    };

    const toggleSelect = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const selectedQrs = qrs
        .filter((qr) => selectedIds.has(qr.id))
        .map((qr) => ({
            id: qr.id,
            uuid: qr.uuid,
            qrData: qr.qrData,
        }));

    return (
        <div className="space-y-4">
            <QRBulkActions
                selectedQrs={selectedQrs}
                onClearSelection={() => setSelectedIds(new Set())}
            />

            <div className="rounded-md border bg-white">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[50px]">
                                <Checkbox
                                    checked={selectedIds.size === qrs.length && qrs.length > 0}
                                    onCheckedChange={toggleSelectAll}
                                    aria-label="Seleccionar todos"
                                />
                            </TableHead>
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
                                <TableCell colSpan={8} className="h-24 text-center text-gray-500">
                                    No hay códigos QR generados.
                                </TableCell>
                            </TableRow>
                        ) : (
                            qrs.map((qr) => (
                                <TableRow key={qr.id} className={selectedIds.has(qr.id) ? "bg-blue-50/30" : ""}>
                                    <TableCell>
                                        <Checkbox
                                            checked={selectedIds.has(qr.id)}
                                            onCheckedChange={() => toggleSelect(qr.id)}
                                            aria-label={`Seleccionar ${qr.uuid}`}
                                        />
                                    </TableCell>
                                    <TableCell className="font-mono text-xs">{qr.uuid}</TableCell>
                                    <TableCell className="font-medium">
                                        {qr.product?.name || <span className="text-red-500">Producto desconocido</span>}
                                    </TableCell>
                                    <TableCell>
                                        {qr.store?.name || <span className="text-red-500">Tienda desconocida</span>}
                                    </TableCell>
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
                                            <QREditButton
                                                id={qr.id}
                                                uuid={qr.uuid}
                                                initialData={{
                                                    productId: qr.productId,
                                                    storeId: qr.storeId,
                                                    fabricationUnitCost: qr.fabricationUnitCost || 0,
                                                    scanCount: qr.scanCount,
                                                    maxScans: qr.maxScans,
                                                }}
                                                stores={stores}
                                                products={products}
                                            />
                                            <QRUpdateKeyButton id={qr.id} uuid={qr.uuid} currentKey={qr.key?.code || null} />
                                            <QRDownloadSVGButton uuid={qr.uuid} qrData={qr.qrData} />
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
        </div>
    );
}
