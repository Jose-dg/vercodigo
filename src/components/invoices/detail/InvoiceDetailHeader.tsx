"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, CheckCircle, XCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "../shared/StatusBadge";
import { MarkAsPaidDialog } from "./MarkAsPaidDialog";
import { InvoiceStatus } from "@prisma/client";

interface InvoiceDetailHeaderProps {
    invoiceId: string;
    invoiceNumber: string;
    status: InvoiceStatus;
}

export function InvoiceDetailHeader({
    invoiceId,
    invoiceNumber,
    status,
}: InvoiceDetailHeaderProps) {
    const [markAsPaidOpen, setMarkAsPaidOpen] = useState(false);

    return (
        <>
            <div className="flex justify-between items-start">
                <div className="space-y-2">
                    <Link href="/invoices">
                        <Button variant="ghost" size="sm">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Volver a Facturas
                        </Button>
                    </Link>
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold">Factura {invoiceNumber}</h1>
                        <StatusBadge status={status} />
                    </div>
                </div>

                <div className="flex gap-2">
                    <Button variant="outline" disabled>
                        <Download className="h-4 w-4 mr-2" />
                        Descargar PDF
                    </Button>
                    {status === InvoiceStatus.PENDING && (
                        <Button onClick={() => setMarkAsPaidOpen(true)}>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Marcar como Pagada
                        </Button>
                    )}
                    {status === InvoiceStatus.PENDING && (
                        <Button variant="destructive" disabled>
                            <XCircle className="h-4 w-4 mr-2" />
                            Anular
                        </Button>
                    )}
                </div>
            </div>

            <MarkAsPaidDialog
                open={markAsPaidOpen}
                onOpenChange={setMarkAsPaidOpen}
                invoiceId={invoiceId}
                invoiceNumber={invoiceNumber}
            />
        </>
    );
}
